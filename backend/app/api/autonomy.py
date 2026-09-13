from __future__ import annotations

from fastapi import APIRouter

from ..engines import autonomy as au

router = APIRouter(prefix="/autonomy", tags=["autonomy"])


@router.get("")
def current() -> dict:
    if not STATE_AUTONOMY_READY():
        au.calculate()
    return STATE_AUTONOMY()


@router.get("/methodology")
def methodology() -> dict:
    return {"methodology": au.METHODOLOGY,
            "note": "Labelled ESTIMATED SAFE AUTONOMY — a planning figure, not an exact prediction."}


def STATE_AUTONOMY_READY() -> bool:
    from ..state.system_state import STATE
    return bool(STATE.autonomy)


def STATE_AUTONOMY() -> dict:
    from ..state.system_state import STATE
    return STATE.autonomy
