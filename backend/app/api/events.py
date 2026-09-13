from __future__ import annotations

from fastapi import APIRouter

from .. import db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def events(limit: int = 200, source: str | None = None) -> dict:
    if source:
        rows = db.query("SELECT * FROM system_events WHERE source=? ORDER BY ts DESC LIMIT ?",
                        (source, limit))
    else:
        rows = db.query("SELECT * FROM system_events ORDER BY ts DESC LIMIT ?", (limit,))
    return {"events": rows}
