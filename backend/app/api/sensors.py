from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from .. import db
from ..engines import ingestion, validation

router = APIRouter(prefix="/sensors", tags=["sensors"])


@router.get("/readings")
def readings(sensor: str | None = None, limit: int = 500) -> dict:
    if sensor:
        rows = db.query("SELECT * FROM sensor_readings WHERE sensor=? ORDER BY ts DESC LIMIT ?",
                        (sensor, limit))
    else:
        rows = db.query("SELECT * FROM sensor_readings ORDER BY ts DESC LIMIT ?", (limit,))
    return {"readings": rows}


@router.get("/quality")
def quality() -> dict:
    return validation.quality_snapshot()


@router.get("/mqtt")
def mqtt_health() -> dict:
    return ingestion.health()


@router.get("/topics")
def topics() -> dict:
    return {"topics": ingestion.TOPICS}


class Reading(BaseModel):
    sensor: str
    value: float
    unit: str = ""
    ts: float | None = None


@router.post("/ingest")
def ingest(r: Reading) -> dict:
    """REST ingestion point for real sensor feeds."""
    out = ingestion.ingest_rest(r.sensor, r.value, r.unit, r.ts)
    validation.process_reading(r.sensor, r.value, r.ts, source="rest")
    return out
