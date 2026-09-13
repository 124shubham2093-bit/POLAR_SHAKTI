from __future__ import annotations

import time

from fastapi import APIRouter

from .. import db
from ..state.system_state import STATE
from ..engines.decision import run_pipeline
from ..engines.baseline import compare as baseline_compare

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.get("/latest")
def latest() -> dict:
    return STATE.recommendation or run_pipeline("api-request")


@router.post("/run")
def run() -> dict:
    return run_pipeline("operator-requested")


@router.get("/baseline-comparison")
def baseline_comparison() -> dict:
    """Compare Baseline (naive) vs POLAR-EMS (optimized) on the same state."""
    return baseline_compare()


@router.post("/approve")
def approve() -> dict:
    with STATE.lock:
        STATE.awaiting_approval = False
        if STATE.recommendation:
            STATE.approved_plan = STATE.recommendation["plan"]
    db.insert("operator_actions", ts=time.time(), actor="operator",
              action="approve_plan", params_json=db.j({"status": STATE.recommendation.get("status")}))
    db.log_event("operator", "Recommendation APPROVED", "Plan applied to simulation dispatch", "ok")
    return {"approved": True}


@router.post("/reject")
def reject() -> dict:
    with STATE.lock:
        STATE.awaiting_approval = False
        STATE.approved_plan = {}
    db.insert("operator_actions", ts=time.time(), actor="operator",
              action="reject_plan", params_json="{}")
    db.log_event("operator", "Recommendation REJECTED", "Reverting to automatic dispatch", "info")
    return {"approved": False}
