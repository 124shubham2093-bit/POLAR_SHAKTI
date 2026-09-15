"""Optimizer Service — optimize_station_v3 implementation.

Enforces:
1. Power balance
2. Battery dynamics with charge/discharge efficiencies
3. Strict 20% minimum SOC at EVERY timestep
4. CQRM-derived final reserve requirement
5. Generator availability limits
6. Usable fuel reserve limits
7. Critical-load priority service
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
import numpy as np
import pandas as pd
from scipy.optimize import Bounds, LinearConstraint, milp

logger = logging.getLogger("polar_ems.optimizer")

ETA_CHARGE = 0.95
ETA_DISCHARGE = 0.95
MAX_BATTERY_CHARGE_KW = 240.0
MAX_BATTERY_DISCHARGE_KW = 240.0
MIN_SAFE_SOC_PCT = 20.0
MIN_FUEL_RESERVE_L = 800.0
DEFAULT_FUEL_TO_ENERGY_KWH_PER_L = 3.0


class OptimizerService:
    @staticmethod
    def optimize_station_v3(
        optimizer_df: pd.DataFrame,
        state: Any,
        min_reserve_soc_pct: float,
        horizon_hours: int = 168,
        fuel_to_energy_kwh_per_l: float = DEFAULT_FUEL_TO_ENERGY_KWH_PER_L
    ) -> Dict[str, Any]:
        df = optimizer_df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True).head(horizon_hours)

        if df.empty:
            raise ValueError("Optimizer dataset is empty.")

        H = len(df)

        def arr(col: str, default: float = 0.0) -> np.ndarray:
            if col in df.columns:
                return pd.to_numeric(df[col], errors="coerce").fillna(default).to_numpy(float)
            return np.full(H, float(default))

        load = np.maximum(0.0, arr("load_forecast_kw"))
        critical_load = np.maximum(0.0, arr("critical_load_kw"))
        flexible_load = np.maximum(0.0, arr("flexible_load_kw"))
        solar = np.maximum(0.0, arr("solar_forecast_kw"))
        wind = np.maximum(0.0, arr("wind_forecast_kw"))
        renewable = solar + wind
        generator_available = np.maximum(0.0, arr("generator_available_kw", getattr(state, "generator_available_kw", 900.0)))

        capacity = max(1e-6, float(state.battery_usable_capacity_kwh))
        initial_energy = np.clip(float(state.battery_energy_kwh), 0.0, capacity)
        minimum_energy = capacity * MIN_SAFE_SOC_PCT / 100.0

        reserve_soc_pct = float(np.clip(min_reserve_soc_pct, MIN_SAFE_SOC_PCT, 85.0))
        reserve_energy = capacity * reserve_soc_pct / 100.0

        initial_fuel = max(0.0, float(state.fuel_remaining_l))
        usable_fuel = max(0.0, initial_fuel - MIN_FUEL_RESERVE_L)
        max_generator_energy = usable_fuel * fuel_to_energy_kwh_per_l

        VARS_PER_HOUR = 6
        G, R, C, D, E, F = 0, 1, 2, 3, 4, 5
        n = H * VARS_PER_HOUR

        def idx(t: int, variable: int) -> int:
            return t * VARS_PER_HOUR + variable

        objective = np.zeros(n)
        for t in range(H):
            objective[idx(t, G)] = 1.0
            objective[idx(t, R)] = -0.15
            objective[idx(t, C)] = 0.01
            objective[idx(t, D)] = 0.01
            objective[idx(t, F)] = -0.10

        lower = np.zeros(n)
        upper = np.full(n, np.inf)

        for t in range(H):
            upper[idx(t, G)] = generator_available[t]
            upper[idx(t, R)] = renewable[t]
            upper[idx(t, C)] = MAX_BATTERY_CHARGE_KW
            upper[idx(t, D)] = MAX_BATTERY_DISCHARGE_KW
            lower[idx(t, E)] = minimum_energy
            upper[idx(t, E)] = capacity
            upper[idx(t, F)] = flexible_load[t]

        A = []
        lb = []
        ub = []

        # 1. Power balance
        for t in range(H):
            row = np.zeros(n)
            row[idx(t, G)] = 1.0
            row[idx(t, R)] = 1.0
            row[idx(t, D)] = 1.0
            row[idx(t, C)] = -1.0
            row[idx(t, F)] = -1.0
            rhs = critical_load[t]
            A.append(row)
            lb.append(rhs)
            ub.append(rhs)

        # 2. Battery dynamics
        for t in range(H):
            row = np.zeros(n)
            row[idx(t, E)] = 1.0
            row[idx(t, C)] = -ETA_CHARGE
            row[idx(t, D)] = 1.0 / ETA_DISCHARGE
            if t == 0:
                rhs = initial_energy
                A.append(row)
                lb.append(rhs)
                ub.append(rhs)
            else:
                row[idx(t - 1, E)] = -1.0
                A.append(row)
                lb.append(0.0)
                ub.append(0.0)

        # 3. Final CQRM reserve
        row = np.zeros(n)
        row[idx(H - 1, E)] = 1.0
        A.append(row)
        lb.append(reserve_energy)
        ub.append(np.inf)

        # 4. Generator fuel limit
        row = np.zeros(n)
        for t in range(H):
            row[idx(t, G)] = 1.0
        A.append(row)
        lb.append(0.0)
        ub.append(max_generator_energy)

        constraints = LinearConstraint(np.vstack(A), np.array(lb), np.array(ub))
        result = milp(
            c=objective,
            integrality=np.zeros(n),
            bounds=Bounds(lower, upper),
            constraints=constraints,
            options={"time_limit": 60}
        )

        if not result.success:
            return {
                "status": "INFEASIBLE",
                "message": str(result.message),
                "required_reserve_soc_pct": reserve_soc_pct,
                "required_reserve_energy_kwh": reserve_energy
            }

        x = result.x
        records = []
        for t in range(H):
            g_val = x[idx(t, G)]
            r_val = x[idx(t, R)]
            c_val = x[idx(t, C)]
            d_val = x[idx(t, D)]
            e_val = x[idx(t, E)]
            f_val = x[idx(t, F)]

            total_served = critical_load[t] + f_val
            curtailment = max(0.0, renewable[t] - r_val)
            f_used = g_val / max(fuel_to_energy_kwh_per_l, 1e-9)
            s_pct = 100.0 * e_val / capacity
            b_err = g_val + r_val + d_val - c_val - total_served

            records.append({
                "timestamp": str(df.loc[t, "timestamp"]),
                "load_kw": float(load[t]),
                "critical_load_kw": float(critical_load[t]),
                "flexible_load_kw": float(flexible_load[t]),
                "flexible_load_served_kw": float(f_val),
                "solar_available_kw": float(solar[t]),
                "wind_available_kw": float(wind[t]),
                "renewable_available_kw": float(renewable[t]),
                "renewable_used_kw": float(r_val),
                "renewable_curtailed_kw": float(curtailment),
                "generator_kw": float(g_val),
                "battery_charge_kw": float(c_val),
                "battery_discharge_kw": float(d_val),
                "battery_energy_kwh": float(e_val),
                "battery_soc_pct": float(s_pct),
                "fuel_used_l": float(f_used),
                "power_balance_error_kw": float(b_err)
            })

        plan = pd.DataFrame(records)

        total_critical = float(np.sum(critical_load))
        critical_coverage_pct = 100.0 if total_critical == 0 else 100.0

        return {
            "status": "OPTIMAL",
            "objective_value": float(result.fun),
            "required_reserve_soc_pct": float(reserve_soc_pct),
            "required_reserve_energy_kwh": float(reserve_energy),
            "initial_battery_energy_kwh": float(initial_energy),
            "final_battery_energy_kwh": float(plan.iloc[-1]["battery_energy_kwh"]),
            "final_battery_soc_pct": float(plan.iloc[-1]["battery_soc_pct"]),
            "generator_energy_kwh": float(plan["generator_kw"].sum()),
            "fuel_used_l": float(plan["fuel_used_l"].sum()),
            "battery_discharge_kwh": float(plan["battery_discharge_kw"].sum()),
            "battery_charge_kwh": float(plan["battery_charge_kw"].sum()),
            "renewable_used_kwh": float(plan["renewable_used_kw"].sum()),
            "renewable_curtailed_kwh": float(plan["renewable_curtailed_kw"].sum()),
            "critical_load_coverage_pct": float(critical_coverage_pct),
            "max_power_balance_error_kw": float(np.max(np.abs(plan["power_balance_error_kw"]))),
            "plan": plan
        }
