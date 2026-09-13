from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..engines import forecast as fc
from ..state.system_state import STATE

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("")
def current_forecast() -> dict:
    if not STATE.latest_forecast:
        fc.forecast()
    return STATE.latest_forecast


@router.get("/history")
def forecast_history(limit: int = 100) -> dict:
    return {"forecasts": db.query("SELECT * FROM forecasts ORDER BY ts DESC LIMIT ?", (limit,))}


@router.get("/model")
def model() -> dict:
    return fc.model_info()


@router.post("/retrain")
def retrain() -> dict:
    return fc.train_models()


@router.post("/simulate-update")
def simulate_update() -> dict:
    return fc.simulate_model_update()
