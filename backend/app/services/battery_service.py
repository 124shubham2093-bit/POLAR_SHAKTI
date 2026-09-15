"""Battery State of Health (SOH) Service.

Wraps ExtraTreesRegressor trained on batch-level holdout validation.
Features: Voltage, Current, Temperature, ChargeTime, DischargeTime,
          InternalResistance, AmbientHumidity, C_Rate.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Union
import numpy as np
import pandas as pd

from .model_loader import get_model_loader

logger = logging.getLogger("polar_ems.battery")

SOH_FEATURES = [
    "Voltage", "Current", "Temperature", "ChargeTime", "DischargeTime",
    "InternalResistance", "AmbientHumidity", "C_Rate"
]


class BatteryService:
    @staticmethod
    def estimate_soh(data: Union[pd.DataFrame, Dict[str, Any], np.ndarray]) -> np.ndarray:
        loader = get_model_loader()
        model = loader.get_model("battery_soh")

        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, np.ndarray):
            if data.ndim == 1:
                data = data.reshape(1, -1)
            if data.shape[1] != len(SOH_FEATURES):
                raise ValueError(f"Expected {len(SOH_FEATURES)} features for Battery SOH, got {data.shape[1]}")
            df = pd.DataFrame(data, columns=SOH_FEATURES)
        else:
            df = data.copy()

        missing = [col for col in SOH_FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"Battery SOH input missing required features: {missing}")

        X = df[SOH_FEATURES].to_numpy(dtype=float)
        preds = model.predict(X)
        return np.clip(preds, 0.0, 100.0)
