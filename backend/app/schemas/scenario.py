"""Pydantic schemas for POLAR-EMS scenarios and decisions."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioRequest(BaseModel):
    scenario: str = Field("NORMAL", description="Scenario name e.g. NORMAL, RESUPPLY_DELAY_4D, STORM, LOW_RENEWABLE, BATTERY_DEGRADATION, SCADA_ANOMALY, COMMUNICATION_LOSS")
    delay_days: float = Field(0.0, description="Additional resupply delay in days")
    battery_soh_override: Optional[float] = Field(None, description="Optional override for battery SOH percentage")
    anomaly_override: Optional[float] = Field(None, description="Optional override for SCADA anomaly score")
    communication_override: Optional[str] = Field(None, description="Optional override for communication status (ONLINE / LOCAL / OFFLINE)")


class ViolationItem(BaseModel):
    code: str
    value: Optional[Any] = None
    limit: Optional[Any] = None


class HourlyDispatchRecord(BaseModel):
    timestamp: str
    load_kw: float
    critical_load_kw: float
    flexible_load_kw: float
    flexible_load_served_kw: float
    solar_available_kw: float
    wind_available_kw: float
    renewable_available_kw: float
    renewable_used_kw: float
    renewable_curtailed_kw: float
    generator_kw: float
    battery_charge_kw: float
    battery_discharge_kw: float
    battery_energy_kwh: float
    battery_soc_pct: float
    fuel_used_l: float
    power_balance_error_kw: float


class ScenarioResponse(BaseModel):
    scenario: str
    safe_operability_days: float
    cqrm_days: float
    risk_level: str
    required_reserve_soc_pct: float
    optimizer_status: str
    safety_status: str
    final_decision: str
    operating_mode: str
    operator_intervention_required: bool
    resupply_p10_days: float
    resupply_p50_days: float
    resupply_p90_days: float
    resupply_margin_days: float
    recommended_action: str
    reason: str
    violations: List[Any] = Field(default_factory=list)
    initial_battery_soc_pct: Optional[float] = None
    final_battery_soc_pct: Optional[float] = None
    initial_fuel_l: Optional[float] = None
    final_fuel_l: Optional[float] = None
    fuel_used_l: Optional[float] = None
    generator_energy_kwh: Optional[float] = None
    renewable_used_kwh: Optional[float] = None
    renewable_curtailed_kwh: Optional[float] = None
    battery_discharge_kwh: Optional[float] = None
    battery_charge_kwh: Optional[float] = None
    first_violation: Optional[Dict[str, Any]] = None
    hourly_plan: Optional[List[HourlyDispatchRecord]] = None
