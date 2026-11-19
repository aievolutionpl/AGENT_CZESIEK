"""Approval-gate hooks for integration trust levels (see :mod:`agent.integration_trust`).

Two entry points, both called from :mod:`tools.approval`:

* :func:`integration_block` — the *floor*: a write to an integration set to ``read`` or ``propose`` is refused
  before yolo / ``approvals.mode: off``, exactly like ``approvals.deny`` rules: it expresses what the agent may
  DO, so no session setting can override it.
* :func:`integration_ask` — for level ``ask`` (the default) returns the action that must go through the human
  prompt even under yolo / mode off. ``auto`` returns None and the write just runs.
"""

from __future__ import annotations

from agent import integration_trust as trust


def integration_block(command: str) -> dict | None:
    for action in trust.classify_all_commands(command):
        level = trust.trust_level(action.integration)
        if level in ("read", "propose"):
            trust.log_decision(action, "blocked", level)
            return {"approved": False, "message": trust.block_message(action, level), "integration_block": True,
                    "pattern_key": action.key, "description": action.describe()}
    return None


def integration_ask_all(command: str) -> "list[trust.IntegrationAction]":
    return [
        action for action in trust.classify_all_commands(command)
        if trust.trust_level(action.integration) == "ask"
    ]


def integration_ask(command: str) -> "trust.IntegrationAction | None":
    actions = integration_ask_all(command)
    return actions[0] if actions else None


def record_outcome(command: str, result: dict) -> None:
    """Log what happened to every classified write once the gate has decided (blocked floors log themselves)."""
    if result.get("integration_block"):
        return
    for action in trust.classify_all_commands(command):
        level = trust.trust_level(action.integration)
        if not result.get("approved"):
            trust.log_decision(action, "denied", level)
        else:
            trust.log_decision(action, "approved" if level == "ask" else "auto", level)
