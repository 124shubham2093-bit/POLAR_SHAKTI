"""Deterministic Safety Validator Service.

Authoritative deterministic validation based on approved Model-7 rules.
Safety rules are never overridden by ML risk estimates.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

logger = logging.getLogger("polar_ems.safety")

SAFETY_RULES = {
    "min_battery_soc_pct": 20.0,
    "min_battery_soh_pct": 70.0,
    "max_battery_temperature_c": 55.0,
    "critical_load_coverage_pct": 100.0,
    "max_power_balance_error_kw": 5.0,
    "min_generator_available_kw": 250.0,
    "min_fuel_reserve_l": 800.0,
    "max_frequency_deviation_pct": 0.50,
    "max_generator_ramp_kw_per_h": 180.0,
    "min_resupply_margin_days": 0.0,
    "max_battery_discharge_kw": 240.0,
}


class SafetyService:
    @staticmethod
    def validate_plan(
        state: Any,
        optimizer_result: Dict[str, Any],
        cqrm_result: Dict[str, Any],
        plan: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        violations: List[Dict[str, Any]] = []

        if optimizer_result.get("status") != "OPTIMAL":
            return {
                "status": "UNSAFE",
                "violations": [{
                    "code": "OPTIMIZER_INFEASIBLE",
                    "value": optimizer_result.get("message", "infeasible"),
                    "limit": "feasible operating plan"
                }],
                "violation_count": 1,
                "minimum_soc_pct": np.nan,
                "battery_soh_pct": float(getattr(state, "battery_soh_pct", np.nan)),
                "battery_temperature_c": float(getattr(state, "temperature_c", np.nan)),
                "critical_load_coverage_pct": 0.0,
                "max_power_balance_error_kw": np.nan,
                "generator_available_kw": float(getattr(state, "generator_available_kw", np.nan)),
                "final_fuel_l": float(getattr(state, "fuel_remaining_l", np.nan)),
                "max_battery_discharge_kw": np.nan,
                "resupply_margin_days": float(cqrm_result.get("cqrm", np.nan))
            }

        if plan is None:
            plan = optimizer_result["plan"]
        plan = plan.copy()

        # 1. Battery SOC
        min_soc = float(plan["battery_soc_pct"].min())
        if min_soc < SAFETY_RULES["min_battery_soc_pct"]:
            violations.append({
                "code": "LOW_BATTERY_SOC",
                "value": min_soc,
                "limit": SAFETY_RULES["min_battery_soc_pct"]
            })

        # 2. Battery SOH
        soh = float(state.battery_soh_pct)
        if not np.isfinite(soh) or soh < SAFETY_RULES["min_battery_soh_pct"]:
            violations.append({
                "code": "LOW_BATTERY_SOH",
                "value": soh,
                "limit": SAFETY_RULES["min_battery_soh_pct"]
            })

        # 3. Battery Temperature
        temp = float(state.temperature_c)
        if not np.isfinite(temp) or temp > SAFETY_RULES["max_battery_temperature_c"]:
            violations.append({
                "code": "BATTERY_OVER_TEMPERATURE",
                "value": temp,
                "limit": SAFETY_RULES["max_battery_temperature_c"]
            })

        # 4. Critical Load Coverage
        critical_cov = float(optimizer_result.get("critical_load_coverage_pct", 0.0))
        if not np.isfinite(critical_cov) or critical_cov < SAFETY_RULES["critical_load_coverage_pct"]:
            violations.append({
                "code": "CRITICAL_LOAD_UNSERVED",
                "value": critical_cov,
                "limit": SAFETY_RULES["critical_load_coverage_pct"]
            })

        # 5. Power Balance Error
        balance_err = float(optimizer_result.get("max_power_balance_error_kw", 0.0))
        if not np.isfinite(balance_err) or balance_err > SAFETY_RULES["max_power_balance_error_kw"]:
            violations.append({
                "code": "POWER_BALANCE_ERROR",
                "value": balance_err,
                "limit": SAFETY_RULES["max_power_balance_error_kw"]
            })

        # 6. Generator Availability
        gen_avail = float(state.generator_available_kw)
        if not np.isfinite(gen_avail) or gen_avail < SAFETY_RULES["min_generator_available_kw"]:
            violations.append({
                "code": "LOW_GENERATOR_AVAILABILITY",
                "value": gen_avail,
                "limit": SAFETY_RULES["min_generator_available_kw"]
            })

        # 7. Fuel Reserve
        final_fuel = float(state.fuel_remaining_l) - float(optimizer_result.get("fuel_used_l", 0.0))
        if not np.isfinite(final_fuel) or final_fuel < SAFETY_RULES["min_fuel_reserve_l"]:
            violations.append({
                "code": "LOW_FUEL_RESERVE",
                "value": final_fuel,
                "limit": SAFETY_RULES["min_fuel_reserve_l"]
            })

        # 8. Battery Discharge Limit
        max_discharge = float(plan["battery_discharge_kw"].max())
        if not np.isfinite(max_discharge) or max_discharge > SAFETY_RULES["max_battery_discharge_kw"]:
            violations.append({
                "code": "BATTERY_DISCHARGE_LIMIT",
                "value": max_discharge,
                "limit": SAFETY_RULES["max_battery_discharge_kw"]
            })

        # 9. Resupply Margin (CQRM must be > 0.0)
        resupply_margin = float(cqrm_result.get("cqrm", 0.0))
        if not np.isfinite(resupply_margin) or resupply_margin <= SAFETY_RULES["min_resupply_margin_days"]:
            violations.append({
                "code": "NEGATIVE_OR_ZERO_RESUPPLY_MARGIN",
                "value": resupply_margin,
                "limit": SAFETY_RULES["min_resupply_margin_days"]
            })

        status = "SAFE" if len(violations) == 0 else "UNSAFE"

        return {
            "status": status,
            "violations": violations,
            "violation_count": len(violations),
            "minimum_soc_pct": min_soc,
            "battery_soh_pct": soh,
            "battery_temperature_c": temp,
            "critical_load_coverage_pct": critical_cov,
            "max_power_balance_error_kw": balance_err,
            "generator_available_kw": gen_avail,
            "final_fuel_l": final_fuel,
            "max_battery_discharge_kw": max_discharge,
            "resupply_margin_days": resupply_margin
        }
