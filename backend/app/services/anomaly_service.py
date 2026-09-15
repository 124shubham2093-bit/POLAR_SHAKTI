"""SCADA Anomaly Detection Service.

Wraps IsolationForest model for abnormal-behavior detection across 23 SCADA features.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Tuple, Union
import numpy as np
import pandas as pd

from .model_loader import get_model_loader

logger = logging.getLogger("polar_ems.anomaly")

SCADA_FEATURES = [
    "Voltage In", "Voltage DC Bus", "Voltage L1", "Voltage L2", "voltage rise",
    "min v from rpm", "Current out", "Power out", "Power reg", "Power max",
    "Line Frequency", "Inverter Frequency", "Line Resistance", "RPM",
    "Windspeed (ref)", "TargetTSR", "Ramp RPM", "Boost pulswidth", "Max BPW",
    "current amplitude", " T1", "T2", "T3"
]


class AnomalyService:
    @staticmethod
    def detect(data: Union[pd.DataFrame, Dict[str, Any], np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        """Returns (is_anomaly_bool_array, anomaly_scores).
        
        For IsolationForest:
        predict == -1 indicates anomaly
        decision_function < 0 indicates higher anomaly severity
        """
        loader = get_model_loader()
        model = loader.get_model("anomaly")

        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, np.ndarray):
            if data.ndim == 1:
                data = data.reshape(1, -1)
            if data.shape[1] != len(SCADA_FEATURES):
                raise ValueError(f"Expected {len(SCADA_FEATURES)} features for SCADA anomaly detector, got {data.shape[1]}")
            df = pd.DataFrame(data, columns=SCADA_FEATURES)
        else:
            df = data.copy()

        missing = [col for col in SCADA_FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"SCADA anomaly input missing required features: {missing}")

        X = df[SCADA_FEATURES].to_numpy(dtype=float)
        preds = model.predict(X)
        scores = model.decision_function(X)
        is_anomaly = (preds == -1)
        # Normalize score into [0, 1] severity measure where higher = more anomalous
        normalized_anomaly_score = np.clip(0.5 - scores, 0.0, 1.0)
        return is_anomaly, normalized_anomaly_score
