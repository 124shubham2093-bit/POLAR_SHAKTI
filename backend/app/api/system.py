from __future__ import annotations

import os
import time

from fastapi import APIRouter

from .. import db
from ..config import DB_PATH
from ..engines import ingestion
from ..state.system_state import STATE

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
def health() -> dict:
    db_ok = True
    try:
        db.query_one("SELECT 1")
    except Exception:
        db_ok = False
    storage_free_mb = None
    try:
        import shutil
        storage_free_mb = round(shutil.disk_usage(os.path.dirname(DB_PATH) or ".").free / 1e6, 1)
    except Exception:
        pass
    return {
        "engines": {
            **STATE.engine_status,
            "ml_fallback_active": STATE.ml_fallback,
            "optimizer_fallback_active": STATE.optimizer_fallback,
        },
        "database": "CONNECTED" if db_ok else "ERROR",
        "local_storage": {"available": True, "free_mb": storage_free_mb},
        "mqtt": ingestion.health()["mqtt_connected"] and "CONNECTED" or "DISCONNECTED",
        "internet": "ONLINE" if STATE.internet_online else "OFFLINE",
        "cloud": "OPTIONAL — AVAILABLE" if STATE.internet_online else "OPTIONAL — UNAVAILABLE",
        "mode": STATE.mode,
        "sim_time_h": round(STATE.now_h(), 2),
    }
