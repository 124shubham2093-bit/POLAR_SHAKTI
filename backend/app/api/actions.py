from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

from .. import db
from ..state.system_state import STATE
from ..engines import autonomy as au
from ..engines import alerts as al
from ..config import SAFETY_RULES

router = APIRouter(prefix="/actions", tags=["actions"])


class Action(BaseModel):
    action: str
    params: dict = {}


@router.post("")
def do_action(a: Action) -> dict:
    """Every operator action is recorded (auditability, §39)."""
    p = a.params
    out: dict = {"action": a.action}

    with STATE.lock:
        if a.action == "set_resupply_date":
            STATE.resupply_date_days = max(0.1, float(p["days"]))
        elif a.action == "set_fuel_level":
            STATE.fuel_l = max(0.0, min(10000.0, float(p["litres"])))
        elif a.action == "set_battery_soc":
            STATE.battery_soc = max(0.0, min(100.0, float(p["soc"])))
        elif a.action == "set_thresholds":
            SAFETY_RULES.update({k: float(v) for k, v in p.items()
                                 if k in SAFETY_RULES})
            out["rules"] = dict(SAFETY_RULES)
        elif a.action == "set_generator_availability":
            STATE.generator_failed = not bool(p["available"])
        elif a.action == "trigger_bad_weather":
            STATE.scenario["bad_weather"] = True
        elif a.action == "trigger_high_demand":
            STATE.scenario["high_heating"] = True
        elif a.action == "trigger_internet_loss":
            STATE.internet_online = False
        elif a.action == "set_flexible_shed":
            STATE.flexible_shed_pct = max(0.0, min(100.0, float(p.get("pct", 0))))
            STATE.operator_overrides["flexible_shed_pct"] = STATE.flexible_shed_pct
        elif a.action == "set_mode":
            STATE.mode = str(p["mode"]).upper()
            STATE.mode_auto = False
            out["mode_auto"] = False
        elif a.action == "resume_auto_mode":
            STATE.mode_auto = True
        else:
            out["error"] = f"unknown action '{a.action}'"
            return out

    db.insert("operator_actions", ts=time.time(), actor="operator",
              action=a.action, params_json=db.j(p))
    db.log_event("operator", f"Operator action: {a.action}", db.j(p), "info")

    # any state change ripples through the whole chain (§56)
    rec_au = au.calculate()
    al.evaluate()
    out["autonomy"] = rec_au
    out["mode"] = STATE.mode
    return out


@router.get("/history")
def history(limit: int = 100) -> dict:
    return {"actions": db.query("SELECT * FROM operator_actions ORDER BY ts DESC LIMIT ?", (limit,))}


@router.get("/rules")
def get_rules() -> dict:
    return {"rules": SAFETY_RULES}
