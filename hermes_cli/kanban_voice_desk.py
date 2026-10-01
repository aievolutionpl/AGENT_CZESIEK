"""Voice work desk: the kanban board as the live voice agent's ledger of delegated work.

The voice model never runs work itself. It hands jobs to the board (:func:`dispatch`), reads the board
back (:func:`digest`, :func:`report`), redirects a worker (:func:`steer`) or stops one
(:func:`cancel`). Every answer is a state the board confirms, so "done" is only said about a task the
board has closed, and a task closed without a run summary is reported as exactly that
(``done_unreported``) instead of as a success.

Text a worker wrote (run summaries, results, comments) reaches the model fenced as external data, like
anything else the user did not type; see :mod:`agent.external_content`.

:func:`nudge` runs one dispatcher tick on demand. The embedded dispatcher lives in the messaging
gateway, and a desktop session may have no gateway running, in which case a new task would wait for
a tick that never comes.
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any, Dict, List, Optional

from agent.external_content import fence
from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_dispatch as kbd
from hermes_cli.kanban_db_connect import connect_closing

logger = logging.getLogger(__name__)

AUTHOR = "voice"
OPEN_STATUSES = frozenset({"triage", "todo", "scheduled", "ready", "running", "blocked", "review"})
ATTENTION = frozenset({"needs_you", "blocked", "stalled", "retrying", "done_unreported"})
# A running task whose worker has been silent this long is reported as stalled, not as working.
STALL_AFTER_S = 15 * 60
RECENT_DONE_S = 24 * 3600
MAX_ITEMS = 8
_TEXT_CHARS = 600
_RESULT_CHARS = 1200
_DEDUPE_WINDOW_S = 120

_LABELS = {
    "pl": {
        "done": "ZAKOŃCZONE",
        "done_unreported": "ZAMKNIĘTE BEZ RAPORTU (nie potwierdzaj sukcesu)",
        "running": "W TOKU",
        "queued": "W KOLEJCE",
        "needs_you": "CZEKA NA ODPOWIEDŹ UŻYTKOWNIKA",
        "blocked": "ZABLOKOWANE",
        "stalled": "PRAWDOPODOBNIE UTKNĘŁO (brak sygnału od pracownika)",
        "retrying": "PONAWIANE PO BŁĘDZIE",
        "in_review": "DO PRZEGLĄDU",
    },
    "en": {
        "done": "DONE",
        "done_unreported": "CLOSED WITHOUT A REPORT (do not claim success)",
        "running": "RUNNING",
        "queued": "QUEUED",
        "needs_you": "WAITING FOR THE USER'S ANSWER",
        "blocked": "BLOCKED",
        "stalled": "PROBABLY STUCK (no signal from the worker)",
        "retrying": "RETRYING AFTER AN ERROR",
        "in_review": "WAITING FOR REVIEW",
    },
}


def _clip(text: Any, limit: int = _TEXT_CHARS) -> str:
    flat = " ".join(str(text or "").split())
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def _labels(lang: str) -> Dict[str, str]:
    return _LABELS["pl" if lang == "pl" else "en"]


def verdict_for(task: Any, has_report: bool, now: int) -> str:
    """One plain word for where a task really stands, from the board's own fields."""
    status = task.status
    if status == "done":
        return "done" if has_report else "done_unreported"
    if status == "blocked":
        return "needs_you" if task.block_kind == "needs_input" else "blocked"
    if status == "review":
        return "in_review"
    if status == "running":
        beat = task.last_heartbeat_at or task.started_at or task.created_at or now
        return "stalled" if now - int(beat) > STALL_AFTER_S else "running"
    return "retrying" if (task.consecutive_failures or 0) > 0 else "queued"


def _line(item: Dict[str, Any], lang: str) -> str:
    """The item as one spoken-ready paragraph; worker text stays inside its fence."""
    head = f'- {item["id"]} „{item["title"]}” ({item["assignee"] or "—"}): {_labels(lang)[item["verdict"]]}'
    parts = [head]
    if item["reason"]:
        parts.append(f'{"Powód" if lang == "pl" else "Reason"}: {item["reason"]}')
    if item["summary"]:
        parts.append(fence(item["summary"], "kanban:worker").strip())
    return "\n".join(parts)


def _item(task: Any, summary: Optional[str], now: int, lang: str) -> Dict[str, Any]:
    verdict = verdict_for(task, bool(summary or task.result), now)
    item = {
        "id": task.id,
        "title": _clip(task.title, 120),
        "assignee": task.assignee,
        "status": task.status,
        "verdict": verdict,
        "attention": verdict in ATTENTION,
        "created_by": task.created_by,
        "session_id": task.session_id,
        "age_s": max(0, now - int(task.created_at or now)),
        "summary": _clip(summary or task.result),
        "reason": _clip(task.last_failure_error) if verdict in ATTENTION else "",
    }
    item["line"] = _line(item, lang)
    return item


def _kanban_config() -> Dict[str, Any]:
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        section = cfg.get("kanban", {}) if isinstance(cfg, dict) else {}
        return section if isinstance(section, dict) else {}
    except Exception:
        logger.debug("voice desk: kanban config unavailable", exc_info=True)
        return {}


def profile_names() -> List[str]:
    from hermes_cli.profiles import list_profiles

    return sorted(profile.name for profile in list_profiles())


def resolve_assignee(assignee: Optional[str]) -> str:
    """The profile that will run a task: the one the caller names, else the configured default."""
    from hermes_cli.profiles import get_active_profile_name, normalize_profile_name

    names = profile_names()

    if assignee and assignee.strip():
        who = normalize_profile_name(assignee)

        if who not in names:
            raise ValueError(f"unknown assistant {who!r}; available: {', '.join(names)}")

        return who

    configured = str(_kanban_config().get("default_assignee") or "").strip()

    return normalize_profile_name(configured or get_active_profile_name() or "default")


def dispatcher_state() -> str:
    """``running`` when a gateway holds the dispatcher lock, ``on_demand`` when nobody does (ticks
    only happen through :func:`nudge`), ``unknown`` when the lock cannot be probed."""
    try:
        from gateway.kanban_watchers_common import _acquire_singleton_lock, _release_singleton_lock

        handle, state = _acquire_singleton_lock(kb.kanban_home() / "kanban" / ".dispatcher.lock")
    except Exception:
        logger.debug("voice desk: dispatcher probe failed", exc_info=True)
        return "unknown"

    if state == "contended":
        return "running"

    _release_singleton_lock(handle)

    return "on_demand" if state == "held" else "unknown"


def nudge() -> int:
    """Run one dispatcher tick now and return how many workers it started.

    Safe beside a live dispatcher: ``dispatch_once`` takes its own per-board tick lock and the
    loser simply skips.
    """
    cfg = _kanban_config()
    positive = kbd._positive_int

    try:
        with connect_closing() as conn:
            result = kbd.dispatch_once(
                conn,
                default_assignee=str(cfg.get("default_assignee") or "").strip() or None,
                max_in_progress=kbd.resolve_max_in_progress(positive(cfg.get("max_in_progress"), None)),
                max_in_progress_per_profile=positive(cfg.get("max_in_progress_per_profile"), None),
                max_spawn=positive(cfg.get("max_spawn"), None),
            )
    except Exception:
        logger.warning("voice desk: dispatcher tick failed", exc_info=True)
        return 0

    return len(result.spawned)


def dispatch(
    title: str,
    details: str = "",
    *,
    assignee: Optional[str] = None,
    priority: int = 0,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Put a job on the board for ``assignee`` and start it right away."""
    title = _clip(title, 200)

    if not title:
        raise ValueError("title is required")

    who = resolve_assignee(assignee)
    details = (details or "").strip()
    body = "Zlecone głosem przez Czesiek." + (f"\n\n{details}" if details else "")
    # The same request repeated inside a couple of minutes (a retried tool call) is one task.
    window = int(time.time() // _DEDUPE_WINDOW_S)
    key = "voice:" + hashlib.sha1(f"{who}\0{title}\0{details}\0{window}".encode()).hexdigest()[:16]

    with connect_closing() as conn:
        task_id = kb.create_task(
            conn,
            title=title,
            body=body,
            assignee=who,
            created_by=AUTHOR,
            priority=max(-10, min(10, int(priority or 0))),
            idempotency_key=key,
            session_id=session_id or None,
        )

    spawned = nudge()

    with connect_closing() as conn:
        task = kb.get_task(conn, task_id)

    return {
        "task_id": task_id,
        "status": task.status if task else "unknown",
        "assignee": who,
        "dispatcher": dispatcher_state(),
        "started": spawned > 0,
    }


def digest(*, limit: int = MAX_ITEMS, lang: str = "pl") -> Dict[str, Any]:
    """Board overview for the voice agent: what needs the user, what runs, what just finished."""
    now = int(time.time())

    with connect_closing() as conn:
        kb.recompute_ready(conn)
        tasks = [task for status in sorted(OPEN_STATUSES) for task in kb.list_tasks(conn, status=status)]
        # Finished work is read by date, not by loading the whole history of a long-lived board.
        rows = conn.execute(
            "SELECT * FROM tasks WHERE status = 'done' AND completed_at >= ?", (now - RECENT_DONE_S,)
        ).fetchall()
        tasks += [kb.Task.from_row(row) for row in rows]
        summaries = kb.latest_summaries(conn, [task.id for task in tasks])

    items = [_item(task, summaries.get(task.id), now, lang) for task in tasks]
    rank = {"attention": 0, "running": 1, "queued": 2, "done": 3}

    def order(item: Dict[str, Any]) -> tuple:
        group = "attention" if item["attention"] else item["verdict"] if item["verdict"] in rank else "queued"

        return rank[group], item["age_s"]

    items.sort(key=order)

    counts = {
        "attention": sum(1 for item in items if item["attention"]),
        "running": sum(1 for item in items if item["verdict"] == "running"),
        "queued": sum(1 for item in items if item["verdict"] in ("queued", "in_review")),
        "done_recent": sum(1 for item in items if item["verdict"] in ("done", "done_unreported")),
    }

    return {
        "at": now,
        "dispatcher": dispatcher_state(),
        "counts": counts,
        "agents": profile_names(),
        "items": items[: max(1, limit)],
        "truncated": len(items) > limit,
    }


def render_digest(data: Dict[str, Any], lang: str = "pl") -> str:
    """The digest as the text the voice model reads: confirmed counts first, then one line per task."""
    c = data["counts"]

    if lang == "pl":
        head = (
            f"Stan tablicy potwierdzony przez backend: {c['running']} w toku, {c['queued']} w kolejce, "
            f"{c['attention']} wymaga uwagi, {c['done_recent']} zakończonych w ostatniej dobie."
        )
        roster = f"Dostępni współpracownicy: {', '.join(data['agents'])}."
        idle = "Tablica jest pusta: nikt teraz nie pracuje."
        cold = (
            "Uwaga: żaden dyspozytor nie działa, więc zadania startują tylko gdy je popchniesz."
            if data["dispatcher"] == "on_demand"
            else ""
        )
    else:
        head = (
            f"Board state confirmed by the backend: {c['running']} running, {c['queued']} queued, "
            f"{c['attention']} need attention, {c['done_recent']} finished in the last day."
        )
        roster = f"Available assistants: {', '.join(data['agents'])}."
        idle = "The board is empty: nobody is working right now."
        cold = "Note: no dispatcher is running, so tasks only start when nudged." if data["dispatcher"] == "on_demand" else ""

    if not data["items"]:
        return " ".join(part for part in (idle, roster) if part)

    lines = [head, roster, cold] + [item["line"] for item in data["items"]]

    if data["truncated"]:
        lines.append("…" if lang == "pl" else "…and more")

    return "\n".join(line for line in lines if line)


def render_dispatch(result: Dict[str, Any], lang: str = "pl") -> str:
    """What the model is told after handing a job over: where it went and what the board says now."""
    who, task_id, status = result["assignee"], result["task_id"], result["status"]
    cold = result["dispatcher"] == "on_demand" and status != "running"

    if lang == "pl":
        state = "już działa" if status == "running" else "czeka w kolejce"
        warning = " Żaden dyspozytor nie działa, więc ruszy dopiero po kolejnym popchnięciu." if cold else ""

        return (
            f"Przekazano do „{who}”, zadanie {task_id}. Stan potwierdzony przez backend: {state}."
            f"{warning} Wynik pojawi się na tablicy; nie potwierdzaj sukcesu przed raportem."
        )

    state = "already running" if status == "running" else "waiting in the queue"
    warning = " No dispatcher is running, so it only starts on the next nudge." if cold else ""

    return (
        f"Handed to {who}, task {task_id}. State confirmed by the backend: {state}.{warning} "
        "The result will land on the board; do not claim success before the report."
    )


def report(task_id: str, *, lang: str = "pl") -> Dict[str, Any]:
    """One task in depth: verdict, run summary, result, last comments, how often it ran."""
    now = int(time.time())

    with connect_closing() as conn:
        task = kb.get_task(conn, task_id)

        if task is None:
            raise KeyError(task_id)

        summary = kb.latest_summary(conn, task_id)
        runs = kb.list_runs(conn, task_id)
        comments = kb.list_comments(conn, task_id)[-3:]

    item = _item(task, summary, now, lang)
    item.update(
        result=_clip(task.result, _RESULT_CHARS),
        runs=len(runs),
        comments=[{"author": c.author, "body": _clip(c.body)} for c in comments],
    )

    return item


def render_report(item: Dict[str, Any], lang: str = "pl") -> str:
    lines = [item["line"]]

    if item["result"] and item["result"] != item["summary"]:
        lines.append(("Wynik:" if lang == "pl" else "Result:") + "\n" + fence(item["result"], "kanban:worker").strip())

    for comment in item["comments"]:
        lines.append(f'{comment["author"]}: ' + fence(comment["body"], f'kanban:comment:{comment["author"]}').strip())

    lines.append(f'Uruchomień: {item["runs"]}.' if lang == "pl" else f'Runs: {item["runs"]}.')

    return "\n".join(lines)


def steer(task_id: str, instruction: str) -> Dict[str, Any]:
    """Give a worker new direction: a comment it reads on its next turn, plus a resume if it was blocked."""
    instruction = (instruction or "").strip()

    if not instruction:
        raise ValueError("instruction is required")

    with connect_closing() as conn:
        task = kb.get_task(conn, task_id)

        if task is None:
            raise KeyError(task_id)

        if task.status in ("done", "archived"):
            raise ValueError(f"task {task_id} is already {task.status}")

        kb.add_comment(conn, task_id, AUTHOR, instruction)
        resumed = kb.unblock_task(conn, task_id) if task.status == "blocked" else False

    nudge()

    return {"task_id": task_id, "resumed": resumed}


def cancel(task_id: str) -> Dict[str, Any]:
    """Stop a task: archive it, which ends its run and releases its workspace."""
    with connect_closing() as conn:
        task = kb.get_task(conn, task_id)

        if task is None:
            raise KeyError(task_id)

        if task.status in ("done", "archived"):
            return {"task_id": task_id, "cancelled": False, "status": task.status}

        kb.add_comment(conn, task_id, AUTHOR, "Anulowane głosem przez użytkownika.")

        return {"task_id": task_id, "cancelled": kb.archive_task(conn, task_id), "status": "archived"}
