from __future__ import annotations

import time

from fastapi import APIRouter

from .. import db
from ..state.system_state import STATE

router = APIRouter(prefix="/connectivity", tags=["connectivity"])


@router.get("")
def status() -> dict:
    return {
        "internet": "ONLINE" if STATE.internet_online else "OFFLINE",
        "mqtt": "CONNECTED" if STATE.mqtt_connected else "DISCONNECTED",
        "cloud": "AVAILABLE" if STATE.internet_online else "UNAVAILABLE",
        "local_engines": {
            "data": "ACTIVE", "ml": "ACTIVE", "optimizer": "ACTIVE",
            "safety": "ACTIVE", "autonomy": "ACTIVE",
        },
        "station_operation": "CONTINUING",
        "sync_queue": STATE.cloud_sync_queue,
    }


@router.post("/simulate-loss")
def simulate_loss() -> dict:
    with STATE.lock:
        STATE.internet_online = False
        STATE.cloud_sync_queue += 247
    db.log_event("connectivity", "Internet connection lost",
                 "Local operation continued — data, ML, optimizer, safety, autonomy all active.",
                 "warning")
    return {"internet": "OFFLINE", "note": "All local engines remain active."}


@router.post("/restore")
def restore() -> dict:
    synced = STATE.cloud_sync_queue
    events_uploaded = 3
    with STATE.lock:
        STATE.internet_online = True
        STATE.cloud_sync_queue = 0
        STATE.last_sync_ts = time.time()
    db.log_event("connectivity", "CONNECTION RESTORED",
                 f"Synchronizing… {synced} records synchronized, "
                 f"{events_uploaded} operational events uploaded, model update available.",
                 "info")
    return {"internet": "ONLINE", "records_synchronized": synced,
            "events_uploaded": events_uploaded, "model_update_available": True}
