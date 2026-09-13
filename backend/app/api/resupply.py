"""Resupply API endpoints with interactive delay slider support."""
from __future__ import annotations

import time
from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import db
from ..state.system_state import STATE
from ..engines import autonomy as au
from ..engines import resupply_model as rm
from ..engines.decision import run_pipeline

router = APIRouter(prefix="/resupply", tags=["resupply"])


class ResupplyConfig(BaseModel):
    resupply_date_days: float | None = None
    expected_fuel_l: float | None = None
    fuel_l: float | None = None
    battery_soc: float | None = None


class ResupplyDelayPayload(BaseModel):
    delay_days: float = Field(..., ge=0.0, le=7.0, description="Resupply delay from 0 to +7 days")


@router.get("")
def get_resupply() -> dict:
    return {
        "config": {
            "resupply_date_days": STATE.resupply_date_days,
            "resupply_delay_days": getattr(STATE, "resupply_delay_days", 0.0),
            "expected_fuel_l": STATE.resupply_fuel_l,
            "fuel_l": STATE.fuel_l,
            "battery_soc": STATE.battery_soc,
        },
        "model": getattr(STATE, "resupply_model", {}) or rm.compute_resupply_distribution(
            delay_days=getattr(STATE, "resupply_delay_days", 0.0)
        ),
        "autonomy": STATE.autonomy,
    }


@router.post("/delay")
def set_resupply_delay(payload: ResupplyDelayPayload) -> dict:
    """Judge slider endpoint: 0 to +7 days.

    Causality: Changing delay updates the resupply distribution, which triggers
    the chance-constrained optimizer to resolve with altered reserves!
    """
    delay = round(payload.delay_days, 1)
    with STATE.lock:
        STATE.resupply_delay_days = delay

    # Run full decision pipeline
    rec = run_pipeline(trigger=f"resupply_delay_{delay:+.0f}d")

    db.insert("operator_actions", ts=time.time(), actor="judge/operator",
              action="set_resupply_delay", params_json=db.j({"delay_days": delay}))
    db.log_event("operator", "Resupply delay slider adjusted",
                 f"Delay set to +{delay:.0f} days. Triggered chance-constrained replan.", "info")

    return {
        "delay_days": delay,
        "resupply_model": STATE.resupply_model,
        "autonomy": STATE.autonomy,
        "recommendation": rec,
        "what_changed": STATE.what_changed,
        "before_after_replan": STATE.before_after_replan,
    }


@router.get("/distribution")
def get_distribution() -> dict:
    return rm.compute_resupply_distribution(
        delay_days=getattr(STATE, "resupply_delay_days", 0.0),
        weather=STATE.weather,
        scenario=STATE.scenario,
    )


@router.post("/configure")
def configure(cfg: ResupplyConfig) -> dict:
    with STATE.lock:
        if cfg.resupply_date_days is not None:
            STATE.resupply_date_days = max(0.1, cfg.resupply_date_days)
        if cfg.expected_fuel_l is not None:
            STATE.resupply_fuel_l = cfg.expected_fuel_l
        if cfg.fuel_l is not None:
            STATE.fuel_l = max(0.0, cfg.fuel_l)
        if cfg.battery_soc is not None:
            STATE.battery_soc = min(100.0, max(0.0, cfg.battery_soc))
    db.insert("operator_actions", ts=time.time(), actor="operator",
              action="configure_resupply", params_json=db.j(cfg.model_dump(exclude_none=True)))
    db.log_event("operator", "Resupply configuration updated",
                 db.j(cfg.model_dump(exclude_none=True)), "info")
    rec = run_pipeline(trigger="configure_resupply")
    return {"autonomy": STATE.autonomy, "recommendation": rec}


@router.get("/required-horizon")
def required_horizon() -> dict:
    a = STATE.autonomy or au.calculate()
    return {
        "required_operating_horizon_days": STATE.resupply_date_days,
        "safe_autonomy_days": a.get("safe_autonomy_days"),
        "margin_days": a.get("autonomy_margin_days"),
        "status": a.get("status"),
        "gap_days": max(0.0, -a.get("autonomy_margin_days", 0)),
    }
