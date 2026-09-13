from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..engines import validation

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/readings")
def readings(sensor: str | None = None, status: str | None = None,
             limit: int = 500) -> dict:
    sql = "SELECT * FROM sensor_readings WHERE 1=1"
    params: list = []
    if sensor:
        sql += " AND sensor=?"
        params.append(sensor)
    if status:
        sql += " AND status=?"
        params.append(status)
    sql += " ORDER BY ts DESC LIMIT ?"
    params.append(limit)
    return {"readings": db.query(sql, tuple(params))}


@router.get("/quality")
def quality() -> dict:
    return validation.quality_snapshot()


@router.get("/forecasts")
def forecasts(limit: int = 200) -> dict:
    return {"forecasts": db.query("SELECT * FROM forecasts ORDER BY ts DESC LIMIT ?", (limit,))}


@router.get("/schedules")
def schedules(limit: int = 50) -> dict:
    runs = db.query("SELECT * FROM optimization_runs ORDER BY ts DESC LIMIT ?", (limit,))
    return {"runs": runs}


@router.get("/safety")
def safety_events(limit: int = 100) -> dict:
    return {"events": db.query("SELECT * FROM safety_events ORDER BY ts DESC LIMIT ?", (limit,))}


@router.get("/operator-actions")
def operator_actions(limit: int = 100) -> dict:
    return {"actions": db.query("SELECT * FROM operator_actions ORDER BY ts DESC LIMIT ?", (limit,))}


@router.get("/sensors")
def sensor_list() -> dict:
    rows = db.query("SELECT DISTINCT sensor FROM sensor_readings")
    return {"sensors": [r["sensor"] for r in rows]}
