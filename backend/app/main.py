"""FastAPI application entry point.

Wires: startup (seed history, train models, start sim loop), API routers,
and the frontend static mount for single-process deployment (Electron-ready).
"""
from __future__ import annotations

import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from . import db
from .sim import seed, loop
from .engines import forecast as fc
from .engines import autonomy as au
from .engines import alerts as al
from .state.system_state import STATE
from .api import (
    station_router, sensors_router, weather_router, forecast_router,
    autonomy_router, optimization_router, safety_router, resupply_router,
    scenarios_router, alerts_router, events_router, system_router,
    connectivity_router, data_router, actions_router, models_router,
)

app = FastAPI(title="POLAR-EMS", version="1.0.0",
              description="Autonomy-Aware Polar Energy Management System — SIMULATION / DEMONSTRATION DATA")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

for r in (station_router, sensors_router, weather_router, forecast_router,
          autonomy_router, optimization_router, safety_router, resupply_router,
          scenarios_router, alerts_router, events_router, system_router,
          connectivity_router, data_router, actions_router, models_router):
    app.include_router(r, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    db.get_conn()
    # seed demo history once
    cnt = db.query_one("SELECT COUNT(*) c FROM sensor_readings")["c"]
    if not cnt:
        n = seed.generate_history()
        db.log_event("system", "Seeded simulation history",
                     f"{n} readings generated (labelled SIMULATION DATA)", "info")
    # train ML models locally
    res = fc.train_models()
    db.log_event("ml", "Model training", str(res.get("status")), "info")
    # initial pipeline so UI has data immediately
    from .engines.decision import run_pipeline
    run_pipeline("startup")
    al.evaluate()
    loop.start()

# serve frontend build if present (single-origin deployment / future Electron)
_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
