"""CQRM (Cumulative Quantile Risk Metric) and Dynamic Reserve Service.

Evaluates resupply-conditioned operational margins and translates them
into battery reserve requirements for the optimization layer.
"""
from __future__ import annotations

import logging
from typing import Any, Dict
import numpy as np

logger = logging.getLogger("polar_ems.cqrm")


class CQRMService:
    @staticmethod
    def calculate_cqrm(
        safe_operability_days: float,
        resupply_p10_days: float,
        resupply_p50_days: float,
        resupply_p90_days: float
    ) -> Dict[str, Any]:
        safe_days = float(safe_operability_days)
        p10 = float(resupply_p10_days)
        p50 = float(resupply_p50_days)
        p90 = float(resupply_p90_days)

        margin_p10 = safe_days - p10
        margin_p50 = safe_days - p50
        margin_p90 = safe_days - p90

        cqrm = margin_p90

        if cqrm > 2.0:
            risk_level = "SAFE"
            recommendation = "Current safe-operability horizon exceeds the conservative resupply estimate."
        elif cqrm > 0.0:
            risk_level = "CAUTION"
            recommendation = "Maintain additional reserve and avoid unnecessary battery discharge."
        elif cqrm > -2.0:
            risk_level = "CONSERVE"
            recommendation = "Conserve energy, increase reserve protection, and prepare for delayed resupply."
        else:
            risk_level = "CRITICAL"
            recommendation = "Current energy horizon is insufficient for the conservative resupply scenario."

        return {
            "safe_operability_days": safe_days,
            "resupply_p10_days": p10,
            "resupply_p50_days": p50,
            "resupply_p90_days": p90,
            "margin_p10_days": margin_p10,
            "margin_p50_days": margin_p50,
            "margin_p90_days": margin_p90,
            "cqrm": cqrm,
            "risk_level": risk_level,
            "recommendation": recommendation
        }

    @staticmethod
    def calculate_reserve_policy(
        cqrm_result: Dict[str, Any],
        battery_capacity_kwh: float
    ) -> Dict[str, Any]:
        cqrm = float(cqrm_result["cqrm"])
        risk_level = cqrm_result["risk_level"]

        if risk_level == "SAFE":
            reserve_soc_pct = 45.0
        elif risk_level == "CAUTION":
            reserve_soc_pct = 55.0
        elif risk_level == "CONSERVE":
            reserve_soc_pct = 65.0
        else:  # CRITICAL
            reserve_soc_pct = 75.0

        if cqrm < 0:
            additional_reserve = min(10.0, abs(cqrm) * 0.5)
            reserve_soc_pct += additional_reserve

        reserve_soc_pct = float(np.clip(reserve_soc_pct, 20.0, 85.0))
        reserve_energy_kwh = battery_capacity_kwh * reserve_soc_pct / 100.0

        return {
            "cqrm_days": cqrm,
            "risk_level": risk_level,
            "required_reserve_soc_pct": reserve_soc_pct,
            "required_reserve_energy_kwh": reserve_energy_kwh
        }
