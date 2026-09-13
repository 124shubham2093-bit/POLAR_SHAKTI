"""Seeded historical data generation.

Generates 30 days of physically coherent history (same relationships as the
live simulator) so forecasts have a training set and analytics have trends
from the first launch. Clearly labelled as SIMULATION / DEMONSTRATION DATA.
"""
from __future__ import annotations

import random
import time as _time

from ..config import SEED_HISTORY_DAYS
from .. import db
from . import weather as wx


def generate_history() -> int:
    """Return number of sensor readings inserted."""
    rng = random.Random(42)  # seeded => reproducible demo data
    now_h = 0.0
    rows: list[dict] = []
    weather_rows: list[dict] = []
    battery_rows: list[dict] = []
    gen_rows: list[dict] = []
    fuel_rows: list[dict] = []

    t_end = SEED_HISTORY_DAYS * 24
    step_h = 1.0  # hourly history
    soc = 62.0
    fuel = 8420.0
    scenario = {}

    # absolute timestamps ending at "now" so live + history are one timeline
    ts0 = _time.time() - t_end * 3600.0

    for t in range(int(t_end)):
        t_h = t * step_h
        temp = wx.temperature_at(t_h, scenario)
        wind = wx.wind_speed_at(t_h, scenario)
        irr = wx.irradiance_at(t_h, scenario)
        cond = wx.condition_for(temp, wind, irr, scenario)
        solar = wx.solar_output_kw(irr, temp)
        wind_kw = wx.wind_output_kw(wind)
        heating = wx.heating_demand_kw(temp, wind)
        essential = 55.0 + heating
        critical = 72.0
        flexible = 50.0 + 10.0 * math_sin_day(t_h)
        load = critical + essential + flexible

        # dispatch same as live rule
        surplus = solar + wind_kw - load
        battery_kw = 0.0
        diesel_kw = 0.0
        if surplus >= 0:
            battery_kw = min(surplus, 300.0)
            if soc < 95:
                soc = min(95.0, soc + battery_kw * 0.95 / 1200.0 * 100)
        else:
            deficit = -surplus
            if soc > 32:
                battery_kw = -min(deficit, 350.0)
                deficit -= (-battery_kw)
                soc = max(30.0, soc + (-battery_kw) / 0.95 / 1200.0 * 100)
            if deficit > 0:
                diesel_kw = min(500.0, deficit)
        if diesel_kw > 0:
            fuel = max(1000.0, fuel - diesel_kw * 0.28)

        ts = ts0 + t_h
        q = round(rng.uniform(0.95, 1.0), 3)
        rows += [
            {"ts": ts, "sensor": "load_kw", "value": round(load, 1), "unit": "kW", "quality": q},
            {"ts": ts, "sensor": "solar_kw", "value": solar, "unit": "kW", "quality": q},
            {"ts": ts, "sensor": "wind_kw", "value": wind_kw, "unit": "kW", "quality": q},
            {"ts": ts, "sensor": "battery_soc", "value": round(soc, 1), "unit": "%", "quality": q},
        ]
        weather_rows.append({"ts": ts, "temperature_c": temp, "wind_speed_ms": wind,
                             "solar_irradiance": irr, "condition": cond})
        battery_rows.append({"ts": ts, "soc_pct": round(soc, 1), "soh_pct": 94.0,
                             "power_kw": round(battery_kw, 1)})
        gen_rows.append({"ts": ts, "running": int(diesel_kw > 0), "output_kw": round(diesel_kw, 1),
                         "fuel_rate_lph": round(diesel_kw * 0.28, 2)})
        fuel_rows.append({"ts": ts, "level_l": round(fuel, 1)})

    # a couple of sensor faults so data-quality page has real issues to show
    if rows:
        rows[100]["value"] = 999.0     # impossible temperature-like spike
        rows[100]["status"] = "anomaly"
        rows[100]["quality"] = 0.2
        rows[250]["value"] = -5.0
        rows[250]["status"] = "suspect"

    db.insert_many("sensor_readings", rows)
    db.insert_many("weather_data", weather_rows)
    db.insert_many("battery_state", battery_rows)
    db.insert_many("generator_state", gen_rows)
    db.insert_many("fuel_state", fuel_rows)
    return len(rows)


def math_sin_day(x: float) -> float:
    import math
    return math.sin(2 * math.pi * (x % 24) / 24 - 1.0)
