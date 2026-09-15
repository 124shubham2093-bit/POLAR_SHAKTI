"""Forecasting Service.

Wraps trained XGBoost Load, Solar, and Wind models with strict feature validation.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Union
import numpy as np
import pandas as pd

from .model_loader import get_model_loader

logger = logging.getLogger("polar_ems.forecasting")

WIND_FEATURES = [
    "Wind Speed (m/s)", "Wind Direction (°)", "Theoretical_Power_Curve (KWh)",
    "hour", "day_of_week", "month", "day_of_year",
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "lag_144",
    "wind_lag_1", "wind_lag_6", "rolling_6", "rolling_18"
]

LOAD_FEATURES = [
    "temp", "dwpt", "rhum", "wdir", "wspd", "pres",
    "hour", "day_of_week", "day_of_month", "month", "day_of_year", "is_weekend",
    "lag_1h", "lag_2h", "lag_3h", "lag_24h", "lag_48h", "lag_168h",
    "rolling_24h_mean", "rolling_24h_std"
]

SOLAR_FEATURES = [
    "DC_POWER", "DAILY_YIELD", "hour", "day_of_week", "day_of_year", "month",
    "lag_1h", "lag_2h", "lag_3h", "lag_24h", "rolling_6h_mean", "rolling_24h_mean"
]


class ForecastingService:
    @staticmethod
    def predict_wind(data: Union[pd.DataFrame, Dict[str, Any], np.ndarray]) -> np.ndarray:
        loader = get_model_loader()
        model = loader.get_model("wind")

        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, np.ndarray):
            if data.ndim == 1:
                data = data.reshape(1, -1)
            if data.shape[1] != len(WIND_FEATURES):
                raise ValueError(f"Expected {len(WIND_FEATURES)} features for Wind Model, got {data.shape[1]}")
            df = pd.DataFrame(data, columns=WIND_FEATURES)
        else:
            df = data.copy()

        missing = [col for col in WIND_FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"Wind model input missing required features: {missing}")

        X = df[WIND_FEATURES].to_numpy(dtype=float)
        preds = model.predict(X)
        return np.maximum(0.0, preds)

    @staticmethod
    def predict_load(data: Union[pd.DataFrame, Dict[str, Any], np.ndarray]) -> np.ndarray:
        loader = get_model_loader()
        model = loader.get_model("load")

        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, np.ndarray):
            if data.ndim == 1:
                data = data.reshape(1, -1)
            if data.shape[1] != len(LOAD_FEATURES):
                raise ValueError(f"Expected {len(LOAD_FEATURES)} features for Load Model, got {data.shape[1]}")
            df = pd.DataFrame(data, columns=LOAD_FEATURES)
        else:
            df = data.copy()

        missing = [col for col in LOAD_FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"Load model input missing required features: {missing}")

        X = df[LOAD_FEATURES].to_numpy(dtype=float)
        preds = model.predict(X)
        return np.maximum(0.0, preds)

    @staticmethod
    def predict_solar(data: Union[pd.DataFrame, Dict[str, Any], np.ndarray]) -> np.ndarray:
        loader = get_model_loader()
        model = loader.get_model("solar")

        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, np.ndarray):
            if data.ndim == 1:
                data = data.reshape(1, -1)
            if data.shape[1] != len(SOLAR_FEATURES):
                raise ValueError(f"Expected {len(SOLAR_FEATURES)} features for Solar Model, got {data.shape[1]}")
            df = pd.DataFrame(data, columns=SOLAR_FEATURES)
        else:
            df = data.copy()

        missing = [col for col in SOLAR_FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"Solar model input missing required features: {missing}")

        X = df[SOLAR_FEATURES].to_numpy(dtype=float)
        preds = model.predict(X)
        return np.maximum(0.0, preds)
