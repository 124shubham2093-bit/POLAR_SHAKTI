"""Shared live SystemState.

Every module (forecasting, autonomy, optimization, safety, API, frontend)
reads and writes this single state object — this is what guarantees
system-wide state consistency (prompt §56).
"""
from __future__ import annotations

import threading
import time
from typing import Any, Optional

from ..config import (
    BATTERY_CAPACITY_KWH, BATTERY_MAX_CHARGE_KW, BATTERY_MAX_DISCHARGE_KW,
    DIESEL_RATED_KW, USABLE_FUEL_L,
)


class SystemState:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.t0 = time.time()
        # ------------------------------------------------------------ plant --
        self.fuel_l: float = 8420.0
        self.battery_soc: float = 62.0
        self.battery_soh: float = 94.0
        self.battery_power_kw: float = 0.0     # + charge, − discharge
        self.generator_running: bool = False
        self.generator_output_kw: float = 0.0
        self.generator_failed: bool = False
        # ----------------------------------------------------------- loads ---
        self.critical_load_kw: float = 72.0
        self.essential_load_kw: float = 60.0
        self.flexible_load_kw: float = 50.0
        self.flexible_shed_pct: float = 0.0
        # --------------------------------------------------------- weather ---
        self.weather: dict = {"temperature_c": -18.0, "wind_speed_ms": 9.0,
                              "solar_irradiance_wm2": 150.0, "condition": "partly cloudy"}
        # ------------------------------------------------------- scenarios ---
        self.scenario: dict = {
            "storm": False, "bad_weather": False, "high_heating": False,
            "low_renewable": False, "resupply_risk": False, "combined": False,
        }
        # ----------------------------------------------------- connectivity --
        self.internet_online: bool = True
        self.mqtt_connected: bool = True
        self.cloud_sync_queue: int = 0
        self.last_sync_ts: Optional[float] = None
        # ------------------------------------------------------------ modes --
        self.mode: str = "NORMAL"   # NORMAL/ENERGY_CONSERVATION/RESUPPLY_RISK/CRITICAL/EMERGENCY
        self.mode_auto: bool = True
        # ------------------------------------------------------------ resupply
        self.resupply_date_days: float = 6.0   # days from now
        self.resupply_delay_days: float = 0.0  # delay slider: 0 to +7 days
        self.resupply_fuel_l: float = 6000.0
        self.resupply_model: dict = {}
        # ----------------------------------------------------------- engines -
        self.engine_status: dict[str, str] = {
            "data": "OPERATIONAL", "ml": "OPERATIONAL",
            "optimizer": "OPERATIONAL", "safety": "OPERATIONAL",
            "database": "CONNECTED", "storage": "AVAILABLE",
        }
        self.ml_fallback: bool = False
        self.optimizer_fallback: bool = False
        # --------------------------------------------------------- forecast --
        self.latest_forecast: dict = {}
        # -------------------------------------------------------- autonomy ---
        self.autonomy: dict = {}
        # ------------------------------------------------------ optimization -
        self.approved_plan: dict = {}
        self.previous_plan: dict = {}
        self.what_changed: list[dict] = []
        self.before_after_replan: dict = {}
        self.safety_result: dict = {}
        self.recommendation: dict = {}
        self.awaiting_approval: bool = False
        # ----------------------------------------------------------- demo ----
        self.demo_state: dict = {
            "active": False, "step": 1, "total_steps": 7,
            "name": "Normal Operation", "paused": False,
        }
        # -------------------------------------------------------- data quality
        self.data_quality: dict = {"score": 100.0, "issues": []}
        # --------------------------------------------------------- operator --
        self.operator_overrides: dict = {}

    # ------------------------------------------------------------- helpers --
    def now_h(self) -> float:
        return (time.time() - self.t0) / 3600.0

    def total_load_kw(self) -> float:
        flex = self.flexible_load_kw * (1.0 - self.flexible_shed_pct)
        return round(self.critical_load_kw + self.essential_load_kw + flex, 1)

    def battery_energy_kwh(self) -> float:
        return BATTERY_CAPACITY_KWH * (self.battery_soc / 100.0) * (self.battery_soh / 100.0)

    def usable_battery_kwh(self, reserve_pct: float) -> float:
        usable_soc = max(0.0, self.battery_soc - reserve_pct)
        return BATTERY_CAPACITY_KWH * (usable_soc / 100.0) * (self.battery_soh / 100.0)

    def fuel_pct(self) -> float:
        return round(self.fuel_l / USABLE_FUEL_L * 100.0, 1)

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return {
                "station": {"id": "maitri-sim", "name": "MAITRI SIMULATION",
                            "simulation": True},
                "sim_time_h": round(self.now_h(), 3),
                "fuel_l": round(self.fuel_l, 1),
                "fuel_pct": self.fuel_pct(),
                "battery_soc": round(self.battery_soc, 1),
                "battery_soh": round(self.battery_soh, 1),
                "battery_power_kw": round(self.battery_power_kw, 1),
                "generator_running": self.generator_running,
                "generator_output_kw": round(self.generator_output_kw, 1),
                "generator_failed": self.generator_failed,
                "loads": {
                    "critical_kw": self.critical_load_kw,
                    "essential_kw": self.essential_load_kw,
                    "flexible_kw": round(self.flexible_load_kw * (1 - self.flexible_shed_pct), 1),
                    "flexible_shed_pct": self.flexible_shed_pct,
                    "total_kw": self.total_load_kw(),
                },
                "weather": dict(self.weather),
                "scenario": dict(self.scenario),
                "connectivity": {
                    "internet": "ONLINE" if self.internet_online else "OFFLINE",
                    "mqtt": "CONNECTED" if self.mqtt_connected else "DISCONNECTED",
                    "cloud": "AVAILABLE" if self.internet_online else "UNAVAILABLE",
                    "sync_queue": self.cloud_sync_queue,
                },
                "mode": self.mode,
                "mode_auto": self.mode_auto,
                "resupply": {
                    "in_days": round(self.resupply_date_days, 2),
                    "delay_days": round(self.resupply_delay_days, 1),
                    "expected_fuel_l": self.resupply_fuel_l,
                    "model": dict(self.resupply_model) if self.resupply_model else {},
                },
                "engines": dict(self.engine_status),
                "ml_fallback": self.ml_fallback,
                "optimizer_fallback": self.optimizer_fallback,
                "data_quality": self.data_quality,
                "what_changed": list(self.what_changed),
                "before_after_replan": dict(self.before_after_replan),
                "demo_state": dict(self.demo_state),
            }


STATE = SystemState()
