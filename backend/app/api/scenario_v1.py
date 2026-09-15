"""V1 Scenario API endpoints."""
from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query

from ..schemas.scenario import ScenarioRequest, ScenarioResponse
from ..services.scenario_service import ScenarioService

logger = logging.getLogger("polar_ems.api.scenario_v1")

router = APIRouter(tags=["scenarios-v1"])


@router.post("/v1/scenario/run", response_model=ScenarioResponse)
@router.post("/scenario/run", response_model=ScenarioResponse)
def run_scenario(req: ScenarioRequest) -> Dict[str, Any]:
    """Execute end-to-end POLAR-EMS scenario simulation:
    
    Station State → Safe Operability (30d) → CQRM → Reserve Policy → Optimizer (HiGHS)
    → Deterministic Safety Validator → Final Operational Decision.
    """
    try:
        result = ScenarioService.run_scenario(
            scenario=req.scenario,
            delay_days=req.delay_days,
            battery_soh_override=req.battery_soh_override,
            anomaly_override=req.anomaly_override,
            communication_override=req.communication_override
        )
        return result
    except Exception as e:
        logger.exception(f"Error running scenario {req.scenario}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/scenario/list")
def list_available_scenarios() -> Dict[str, Any]:
    """List supported stress scenarios and standard parameters."""
    return {
        "scenarios": [
            {
                "id": "NORMAL",
                "label": "Normal Operations",
                "description": "Nominal load and renewable profile with standard resupply window."
            },
            {
                "id": "RESUPPLY_DELAY_4D",
                "label": "Resupply Delay +4 Days",
                "description": "Logistics disruption pushes conservative resupply ETA out by 4 days, testing CQRM reserve escalation."
            },
            {
                "id": "STORM",
                "label": "Antarctic Storm",
                "description": "Severe weather reducing wind (0.45x) and solar (0.65x) availability."
            },
            {
                "id": "LOW_RENEWABLE",
                "label": "Extended Low Renewable",
                "description": "Prolonged overcast and calm conditions testing fuel and battery endurance."
            },
            {
                "id": "BATTERY_DEGRADATION",
                "label": "Battery Degradation (75% SOH)",
                "description": "Battery State of Health drops to 75%, shrinking usable storage capacity."
            },
            {
                "id": "SCADA_ANOMALY",
                "label": "SCADA Anomaly Detected",
                "description": "Early abnormal turbine behavior detected by Isolation Forest, stress-tested with generator derating."
            },
            {
                "id": "COMMUNICATION_LOSS",
                "label": "Communication Blackout",
                "description": "Loss of external satellite link; core safety and optimization continue in LOCAL autonomous mode."
            }
        ]
    }
