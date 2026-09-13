from __future__ import annotations

from fastapi import APIRouter

from ..engines import forecast as fc

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
def model_info() -> dict:
    return fc.model_info()


@router.post("/check-updates")
def check_updates() -> dict:
    """Simulated cloud model-update check — only meaningful when online."""
    from ..state.system_state import STATE
    if not STATE.internet_online:
        return {"update_available": False,
                "note": "Offline: using currently installed local model."}
    return {"update_available": True, "candidate_version": "ridge-1.3.0-candidate",
            "note": "Model update available — validation required before promotion."}


@router.post("/update")
def update_model() -> dict:
    return fc.simulate_model_update()
