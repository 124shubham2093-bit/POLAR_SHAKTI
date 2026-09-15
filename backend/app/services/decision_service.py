"""Decision Service.

Arbitrates the final operational decision:
- The Optimizer recommends.
- The Deterministic Safety Validator has authoritative final decision.
- The Operator remains responsible for approval.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger("polar_ems.decision")


class DecisionService:
    @staticmethod
    def run_final_decision(
        state: Any,
        cqrm_result: Dict[str, Any],
        optimizer_result: Dict[str, Any],
        safety_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        status = safety_result.get("status")

        if status == "SAFE":
            return {
                "final_decision": "ACCEPT_PLAN",
                "operating_mode": "NORMAL",
                "risk_level": cqrm_result.get("risk_level", "SAFE"),
                "cqrm_days": cqrm_result.get("cqrm", 0.0),
                "resupply_margin_days": safety_result.get("resupply_margin_days", 0.0),
                "recommended_action": "Accept the optimized operating plan.",
                "reason": "The proposed plan satisfies all deterministic safety constraints.",
                "requires_operator_intervention": False,
                "violations": []
            }

        violations = safety_result.get("violations", [])
        violation_codes = [v["code"] if isinstance(v, dict) else str(v) for v in violations]
        recommendations: List[str] = []

        if "NEGATIVE_OR_ZERO_RESUPPLY_MARGIN" in violation_codes:
            recommendations.append("Increase energy conservation and escalate the resupply risk to the operator.")
        if "LOW_BATTERY_SOC" in violation_codes:
            recommendations.append("Protect battery reserve and reduce non-critical battery discharge.")
        if "LOW_FUEL_RESERVE" in violation_codes:
            recommendations.append("Preserve fuel reserve and increase generator-fuel monitoring.")
        if "CRITICAL_LOAD_UNSERVED" in violation_codes:
            recommendations.append("Protect all critical loads and shed non-essential flexible loads.")
        if "OPTIMIZER_INFEASIBLE" in violation_codes:
            recommendations.append("Optimizer found no feasible plan under current severe constraints. Engage emergency backup.")

        if not recommendations:
            recommendations.append("Reject the proposed operating plan and request operator intervention.")

        return {
            "final_decision": "REJECT_PLAN",
            "operating_mode": "CONSERVATION",
            "risk_level": cqrm_result.get("risk_level", "CRITICAL"),
            "cqrm_days": cqrm_result.get("cqrm", 0.0),
            "resupply_margin_days": safety_result.get("resupply_margin_days", 0.0),
            "recommended_action": " ".join(recommendations),
            "reason": "The proposed optimization plan violates one or more deterministic safety constraints.",
            "requires_operator_intervention": True,
            "violations": violation_codes
        }
