"""Simulated weather model for MAITRI SIMULATION.

Deterministic diurnal + synoptic weather with scenario overrides.
Generates coupled temperature / wind / irradiance / condition, from which
heating demand and renewable output are derived downstream.
"""
from __future__ import annotations

import math
import random

from ..config import SOLAR_CAPACITY_KW, WIND_CAPACITY_KW


def temperature_at(t_h: float, scenario: dict) -> float:
    """Ambient temperature (°C). t_h = hours since simulation epoch."""
    base = -18.0 + 6.0 * math.sin(2 * math.pi * (t_h % 24) / 24 - math.pi / 3)
    synoptic = 4.0 * math.sin(2 * math.pi * t_h / 72)  # 3-day weather systems
    temp = base + synoptic + random.uniform(-0.8, 0.8)
    if scenario.get("bad_weather") or scenario.get("storm"):
        temp -= 10.0
    if scenario.get("high_heating"):
        temp -= 6.0
    return round(temp, 1)


def wind_speed_at(t_h: float, scenario: dict) -> float:
    base = 9.0 + 5.0 * math.sin(2 * math.pi * t_h / 36 + 1.0)
    gust = 2.0 * math.sin(2 * math.pi * t_h / 6)
    wind = max(0.0, base + gust + random.uniform(-1.5, 1.5))
    if scenario.get("storm") or scenario.get("bad_weather"):
        wind = min(28.0, wind + 9.0)
    if scenario.get("low_renewable"):
        wind *= 0.35
    return round(wind, 1)


def irradiance_at(t_h: float, scenario: dict) -> float:
    """Global horizontal irradiance, W/m²."""
    hour = t_h % 24
    # Polar day/night envelope — dim sun, long dawn/dusk
    day_factor = max(0.0, math.sin(math.pi * (hour - 4) / 16)) if 4 <= hour <= 20 else 0.0
    clear = 420.0 * day_factor
    clouds = 0.55 + 0.25 * math.sin(2 * math.pi * t_h / 48)
    irr = clear * clouds
    if scenario.get("storm") or scenario.get("bad_weather") or scenario.get("low_renewable"):
        irr *= 0.25
    return round(max(0.0, irr), 1)


def condition_for(temp_c: float, wind_ms: float, irr: float, scenario: dict) -> str:
    if scenario.get("storm"):
        return "storm"
    if wind_ms > 18:
        return "blizzard"
    if irr > 200 and temp_c > -20:
        return "clear"
    if irr > 80:
        return "partly cloudy"
    return "overcast"


def weather_snapshot(t_h: float, scenario: dict) -> dict:
    temp = temperature_at(t_h, scenario)
    wind = wind_speed_at(t_h, scenario)
    irr = irradiance_at(t_h, scenario)
    return {
        "temperature_c": temp,
        "wind_speed_ms": wind,
        "solar_irradiance_wm2": irr,
        "condition": condition_for(temp, wind, irr, scenario),
    }


# ----------------------------------------------------------- translations ---

def solar_output_kw(irradiance_wm2: float, temp_c: float) -> float:
    """PV output: irradiance-driven with cold-weather efficiency bonus."""
    if irradiance_wm2 <= 0:
        return 0.0
    eff = 0.20 * (1 + 0.004 * max(0.0, -temp_c - 10))  # cold improves PV slightly
    return round(min(SOLAR_CAPACITY_KW, SOLAR_CAPACITY_KW * irradiance_wm2 / 1000.0 * (eff / 0.20) * 0.9), 1)


def wind_output_kw(wind_ms: float) -> float:
    """Turbine power curve: cut-in 3, rated 12, cut-out 25 m/s (storm lock)."""
    if wind_ms < 3 or wind_ms >= 25:
        return 0.0
    if wind_ms >= 12:
        return round(WIND_CAPACITY_KW, 1)
    # cubic region between cut-in and rated
    frac = (wind_ms ** 3 - 3 ** 3) / (12 ** 3 - 3 ** 3)
    return round(WIND_CAPACITY_KW * frac, 1)


def heating_demand_kw(temp_c: float, wind_ms: float) -> float:
    """Space-heating load: strongly temperature-driven, wind adds envelope loss."""
    severity = max(0.0, -temp_c - 10)  # degrees below mild
    base = 30.0 + 2.6 * severity
    windchill_extra = 0.35 * max(0.0, wind_ms - 8)
    return round(base + windchill_extra, 1)


def renewable_uncertainty(weather: dict) -> float:
    """0..1 uncertainty factor fed to forecasting/reserves."""
    u = 0.08
    if weather["wind_speed_ms"] > 15 or weather["condition"] in ("storm", "blizzard"):
        u += 0.25
    if weather["solar_irradiance_wm2"] > 0 and weather["condition"] != "clear":
        u += 0.10
    if weather["condition"] == "overcast":
        u += 0.05
    return round(min(0.5, u), 2)
