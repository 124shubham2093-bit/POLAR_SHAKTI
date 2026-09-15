"""Safe Operability Service.

Performs 30-day forward simulation to calculate how long the station
can safely operate while strictly respecting physical and safety limits.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

logger = logging.getLogger("polar_ems.operability")

# Operational defaults
MIN_SOC_PCT = 20.0
MIN_SOH_PCT = 70.0
MIN_FUEL_L = 800.0
MIN_GENERATOR_AVAILABLE_KW = 250.0
DEFAULT_FUEL_TO_ENERGY_KWH_PER_L = 3.0


class OperabilityService:
    @staticmethod
    def prepare_future_profile(
        optimizer_df: pd.DataFrame,
        start_timestamp: Optional[str] = None,
        horizon_hours: int = 30 * 24
    ) -> pd.DataFrame:
        df = optimizer_df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)

        if start_timestamp is not None:
            ts = pd.to_datetime(start_timestamp)
            future = df[df["timestamp"] >= ts].copy()
            if len(future) == 0:
                future = df.copy()
        else:
            future = df.copy()

        return future.head(horizon_hours).reset_index(drop=True)

    @classmethod
    def calculate_safe_operability(
        cls,
        state: Any,
        optimizer_df: pd.DataFrame,
        start_timestamp: Optional[str] = None,
        horizon_hours: int = 30 * 24,
        fuel_to_energy_kwh_per_l: float = DEFAULT_FUEL_TO_ENERGY_KWH_PER_L
    ) -> Dict[str, Any]:
        profile = cls.prepare_future_profile(
            optimizer_df,
            start_timestamp=start_timestamp,
            horizon_hours=horizon_hours
        )

        if profile.empty:
            raise ValueError("No future operating profile available.")

        battery_capacity = max(0.0, float(state.battery_usable_capacity_kwh))
        battery_energy = np.clip(float(state.battery_energy_kwh), 0.0, battery_capacity)
        fuel_remaining = max(0.0, float(state.fuel_remaining_l))
        soh_pct = float(state.battery_soh_pct)
        generator_available = float(state.generator_available_kw)
        critical_load = max(0.0, float(state.critical_load_kw))
        min_battery_energy = battery_capacity * MIN_SOC_PCT / 100.0

        safe_hours = 0
        first_violation = None
        hourly_records: List[Dict[str, Any]] = []

        for _, row in profile.iterrows():
            timestamp = str(row["timestamp"])
            load = max(0.0, float(row.get("load_forecast_kw", 0.0)))
            critical = max(0.0, float(row.get("critical_load_kw", critical_load)))
            solar = max(0.0, float(row.get("solar_forecast_kw", 0.0)))
            wind = max(0.0, float(row.get("wind_forecast_kw", 0.0)))
            renewable = max(0.0, solar + wind)
            generator_capacity = max(0.0, float(row.get("generator_available_kw", generator_available)))

            critical_net = max(0.0, critical - renewable)
            generator_used = min(critical_net, generator_capacity)
            remaining_critical = max(0.0, critical_net - generator_used)

            battery_available = max(0.0, battery_energy - min_battery_energy)
            battery_used = min(remaining_critical, battery_available)
            remaining_critical = max(0.0, remaining_critical - battery_used)

            fuel_used = generator_used / max(fuel_to_energy_kwh_per_l, 1e-9)
            fuel_remaining -= fuel_used

            battery_energy -= battery_used
            battery_energy = max(0.0, battery_energy)
            soc_pct = 100.0 * battery_energy / max(battery_capacity, 1e-9)

            violations: List[str] = []
            if soh_pct < MIN_SOH_PCT:
                violations.append("LOW_BATTERY_SOH")
            if soc_pct < MIN_SOC_PCT:
                violations.append("LOW_BATTERY_SOC")
            if generator_capacity < MIN_GENERATOR_AVAILABLE_KW:
                violations.append("INSUFFICIENT_GENERATOR_AVAILABILITY")
            if fuel_remaining < MIN_FUEL_L:
                violations.append("LOW_FUEL_RESERVE")
            if remaining_critical > 1e-4:
                violations.append("CRITICAL_LOAD_CANNOT_BE_SERVED")

            if violations and first_violation is None:
                first_violation = {
                    "timestamp": timestamp,
                    "violations": violations
                }

            if not violations:
                safe_hours += 1

            hourly_records.append({
                "timestamp": timestamp,
                "load_kw": load,
                "critical_load_kw": critical,
                "solar_kw": solar,
                "wind_kw": wind,
                "renewable_kw": renewable,
                "generator_used_kw": generator_used,
                "battery_used_kwh": battery_used,
                "battery_energy_kwh": battery_energy,
                "battery_soc_pct": soc_pct,
                "fuel_remaining_l": fuel_remaining,
                "violations": violations
            })

            if violations:
                break

        safe_operability_days = safe_hours / 24.0

        return {
            "safe_operability_days": float(safe_operability_days),
            "safe_hours": int(safe_hours),
            "initial_battery_energy_kwh": float(state.battery_energy_kwh),
            "final_battery_energy_kwh": float(battery_energy),
            "final_battery_soc_pct": float(100.0 * battery_energy / max(battery_capacity, 1e-9)),
            "initial_fuel_l": float(state.fuel_remaining_l),
            "final_fuel_l": float(fuel_remaining),
            "first_violation": first_violation,
            "status": "SAFE" if first_violation is None else "AT_RISK",
            "hourly_trace": pd.DataFrame(hourly_records)
        }
