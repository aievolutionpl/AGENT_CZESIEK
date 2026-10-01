"""What the live voice agent reaches for besides Hermes: the work board and the user's screen.

- ``GET  /api/voice/desk``                      board digest (what needs the user, what runs, what finished)
- ``POST /api/voice/desk/dispatch``             hand a job to a colleague on the kanban board
- ``GET  /api/voice/desk/tasks/{id}``           one task in depth
- ``POST /api/voice/desk/tasks/{id}/steer``     give a worker new direction
- ``POST /api/voice/desk/tasks/{id}/cancel``    stop a task
- ``POST /api/voice/vision``                    describe a screenshot the desktop captured on request

Every answer carries ``text``: the wording the voice model is given, with worker and screen text fenced as
external data. Logic lives in :mod:`hermes_cli.kanban_voice_desk` and :mod:`agent.screen_vision`.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from hermes_cli.web_routers._common import scoped_to_thread

router = APIRouter()
log = logging.getLogger(__name__)

_LANGUAGE_NAMES = {"pl": "Polish", "en": "English"}


class DispatchBody(BaseModel):
    title: str
    details: str = ""
    assignee: Optional[str] = None
    priority: int = 0
    session_id: Optional[str] = None
    profile: Optional[str] = None
    lang: str = "pl"


class SteerBody(BaseModel):
    instruction: str
    profile: Optional[str] = None


class VisionBody(BaseModel):
    image: str
    question: str = ""
    profile: Optional[str] = None
    lang: str = "pl"


def _desk():
    from hermes_cli import kanban_voice_desk

    return kanban_voice_desk


def _missing(task_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"unknown task {task_id}")


@router.get("/api/voice/desk")
async def get_desk(profile: Optional[str] = None, lang: str = "pl", limit: int = Query(default=8, ge=1, le=30)):
    desk = _desk()

    def read():
        data = desk.digest(limit=limit, lang=lang)

        return {**data, "text": desk.render_digest(data, lang)}

    return await scoped_to_thread(profile, read)


@router.post("/api/voice/desk/dispatch")
async def dispatch_work(body: DispatchBody):
    desk = _desk()

    def run():
        result = desk.dispatch(
            body.title, body.details, assignee=body.assignee, priority=body.priority, session_id=body.session_id
        )

        return {**result, "text": desk.render_dispatch(result, body.lang)}

    try:
        return await scoped_to_thread(body.profile, run)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/voice/desk/tasks/{task_id}")
async def get_task_report(task_id: str, profile: Optional[str] = None, lang: str = "pl"):
    desk = _desk()

    def read():
        item = desk.report(task_id, lang=lang)

        return {**item, "text": desk.render_report(item, lang)}

    try:
        return await scoped_to_thread(profile, read)
    except KeyError:
        raise _missing(task_id)


@router.post("/api/voice/desk/tasks/{task_id}/steer")
async def steer_task(task_id: str, body: SteerBody):
    try:
        return await scoped_to_thread(body.profile, lambda: _desk().steer(task_id, body.instruction))
    except KeyError:
        raise _missing(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/voice/desk/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, profile: Optional[str] = None):
    try:
        return await scoped_to_thread(profile, lambda: _desk().cancel(task_id))
    except KeyError:
        raise _missing(task_id)


@router.post("/api/voice/vision")
async def describe_screen(body: VisionBody):
    from agent import screen_vision

    language = _LANGUAGE_NAMES.get(body.lang, "Polish")

    try:
        text = await screen_vision.describe(body.image, body.question, language=language)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        log.warning("screen vision failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"The vision model could not read the screen: {exc}")

    return {"text": text}
