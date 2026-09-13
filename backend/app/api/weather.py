from __future__ import annotations

from fastapi import APIRouter

from .. import db
from ..state.system_state import STATE

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current")
def current() -> dict:
    return STATE.weather


@router.get("/history")
def history(hours: int = 72) -> dict:
    import time
    since = time.time() - hours * 3600
    rows = db.query("SELECT * FROM weather_data WHERE ts > ? ORDER BY ts", (since,))
    return {"series": rows}


@router.get("/impact")
def impact() -> dict:
    """Weather → operational impact translation (§22)."""
    w = STATE.weather
    temp, wind, irr = w["temperature_c"], w["wind_speed_ms"], w["solar_irradiance_wm2"]
    heating = "LOW" if temp > -15 else ("MODERATE" if temp > -25 else "HIGH")
    solar = "LOW" if irr < 80 else ("MODERATE" if irr < 250 else "GOOD")
    wind_cat = ("UNCERTAIN (storm lock risk)" if wind > 20 else
                "HIGH" if wind > 14 else "MODERATE" if wind > 6 else "LOW")
    unc = "HIGH" if (wind > 15 or w["condition"] in ("storm", "blizzard")) else "MODERATE"
    return {
        "weather": w,
        "impacts": {
            "heating_demand": heating,
            "solar_generation": solar,
            "wind_generation": wind_cat,
            "renewable_uncertainty": unc,
        },
    }
