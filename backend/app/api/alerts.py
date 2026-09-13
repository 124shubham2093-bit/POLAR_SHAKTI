from __future__ import annotations

from fastapi import APIRouter

from ..engines import alerts as al

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(active_only: bool = True) -> dict:
    return {"alerts": al.list_alerts(active_only)}


@router.post("/ack/{alert_id}")
def ack(alert_id: int) -> dict:
    al.acknowledge(alert_id)
    return {"acknowledged": alert_id}
