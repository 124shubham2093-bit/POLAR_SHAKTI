from __future__ import annotations

from fastapi import APIRouter, Query
from ..engines import scenarios as sc

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("")
def list_scenarios() -> dict:
    return {
        "primary": list(sc.PRIMARY_SCENARIOS.values()),
        "secondary": list(sc.SECONDARY_SCENARIOS.values()),
        "all": [{"id": k, "label": v["label"], "category": v.get("category", "secondary")} for k, v in sc.SCENARIOS.items()],
        "demo_steps": sc.DEMO_STEPS,
    }


@router.post("/activate/{name}")
def activate(name: str) -> dict:
    return sc.activate(name)


@router.post("/demo/start")
def demo_start() -> dict:
    return sc.start_demo()


@router.post("/demo/next")
def demo_next() -> dict:
    return sc.next_demo_step()


@router.post("/demo/prev")
def demo_prev() -> dict:
    return sc.prev_demo_step()


@router.post("/demo/jump/{step_number}")
def demo_jump(step_number: int) -> dict:
    return sc.execute_demo_step(step_number)


@router.post("/demo/pause")
def demo_pause() -> dict:
    return sc.pause_demo()


@router.post("/demo/stop")
def demo_stop() -> dict:
    return sc.stop_demo()


@router.get("/demo/status")
def demo_status() -> dict:
    return sc.demo_status()
