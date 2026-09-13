"""Probabilistic resupply ETA model.

Antarctic research stations (e.g. Maitri / Bharati) depend on weather-gated
resupply convoys or ice-strengthened vessels. Severe weather, blizzards, and
crevasse-risk windows cause non-linear logistics delays.

This engine computes:
- Expected, conservative (P90 risk horizon), and optimistic (P10) resupply ETAs.
- Cumulative shortfall / arrival probability distribution over time.
- Weather-gated delay factors (temperature, wind/blizzard conditions).
"""
from __future__ import annotations

import math
from typing import Any

from ..state.system_state import STATE

BASE_SCHEDULED_DAYS = 6.2


def compute_resupply_distribution(
    delay_days: float | None = None,
    weather: dict | None = None,
    scenario: dict | None = None,
) -> dict[str, Any]:
    """Compute probabilistic arrival distribution given delay and weather conditions."""
    if delay_days is None:
        delay_days = getattr(STATE, "resupply_delay_days", 0.0)
    wx = weather or STATE.weather
    scen = scenario or STATE.scenario

    wind = wx.get("wind_speed_ms", 10.0)
    temp = wx.get("temperature_c", -18.0)
    is_storm = scen.get("storm") or scen.get("bad_weather") or wind > 20.0

    # Weather impact factor on convoy speed and landing clearance
    weather_delay_factor = 0.0
    weather_uncertainty = 0.5
    weather_desc = "Favorable weather window"

    if is_storm or wind > 25.0:
        weather_delay_factor = 1.8
        weather_uncertainty = 1.4
        weather_desc = "Blizzard/High winds: Convoy travel halted at ice shelf"
    elif wind > 15.0 or temp < -25.0:
        weather_delay_factor = 0.8
        weather_uncertainty = 0.9
        weather_desc = "Marginal conditions: Reduced convoy transit speed"

    base = BASE_SCHEDULED_DAYS + delay_days
    expected_days = round(base + weather_delay_factor, 1)
    conservative_days = round(expected_days + weather_uncertainty * 1.5 + (0.5 * delay_days), 1)
    optimistic_days = round(max(1.0, expected_days - weather_uncertainty * 1.0), 1)

    # Generate daily arrival probability density (discretized Weibull/Gaussian-like curve)
    # over days 1 to 14
    daily_probs = []
    cum_prob = 0.0
    sigma = max(0.8, weather_uncertainty * 1.2 + 0.2 * delay_days)
    mu = expected_days

    for d in range(1, 15):
        # Gaussian PDF slice
        z = (d - mu) / sigma
        p = (1.0 / (sigma * math.sqrt(2 * math.pi))) * math.exp(-0.5 * z * z)
        p = round(max(0.001, min(0.95, p)), 3)
        cum_prob = round(min(1.0, cum_prob + p), 3)
        daily_probs.append({
            "day": d,
            "marginal_probability": p,
            "cumulative_arrival_probability": cum_prob,
        })

    # Normalize cumulative probabilities to ensure monotonically reaching ~1.0
    if daily_probs:
        max_c = daily_probs[-1]["cumulative_arrival_probability"]
        if max_c > 0:
            for item in daily_probs:
                item["cumulative_arrival_probability"] = round(min(1.0, item["cumulative_arrival_probability"] / max_c), 3)

    return {
        "scheduled_base_days": BASE_SCHEDULED_DAYS,
        "slider_delay_days": round(float(delay_days), 1),
        "expected_days": expected_days,
        "conservative_days": conservative_days,  # Safe planning horizon
        "optimistic_days": optimistic_days,
        "confidence_level": 0.90,
        "weather_delay_factor_days": round(weather_delay_factor, 1),
        "weather_impact": weather_desc,
        "primary_uncertainty": "Ice shelf travel window + blizzard visibility" if is_storm else "Normal seasonal variability",
        "daily_distribution": daily_probs,
        "data_status": "Simulated logistics model based on Antarctic weather windows",
    }
