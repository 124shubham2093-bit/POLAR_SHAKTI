from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..config import SAFETY_RULES
from ..state.system_state import STATE

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/rules")
def rules() -> dict:
    return {"rules": SAFETY_RULES}


@router.get("/latest")
@router.post("/validate")
def latest() -> dict:
    return STATE.safety_result or {"passed": True, "checks": []}


@router.get("/events")
def events(limit: int = 100) -> dict:
    return {"events": db.query("SELECT * FROM safety_events ORDER BY ts DESC LIMIT ?", (limit,))}
