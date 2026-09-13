"""SQLite persistence layer.

Tables cover stations, sensor readings, weather, battery/generator/fuel
state, forecasts, optimization runs, schedules, safety events, alerts,
operator actions, resupply events and the system event log.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Optional

from .config import DB_PATH

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    sensor TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    quality REAL,            -- 0..1 data-quality score of this reading
    source TEXT DEFAULT 'simulated',
    status TEXT DEFAULT 'ok'
);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON sensor_readings(ts);
CREATE INDEX IF NOT EXISTS idx_readings_sensor_ts ON sensor_readings(sensor, ts);
CREATE TABLE IF NOT EXISTS weather_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    temperature_c REAL, wind_speed_ms REAL, solar_irradiance REAL,
    condition TEXT
);
CREATE TABLE IF NOT EXISTS battery_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    soc_pct REAL, soh_pct REAL, power_kw REAL
);
CREATE TABLE IF NOT EXISTS generator_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    running INTEGER, output_kw REAL, fuel_rate_lph REAL
);
CREATE TABLE IF NOT EXISTS fuel_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    level_l REAL
);
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    horizon_h REAL NOT NULL,
    target TEXT NOT NULL,          -- load / heating / solar / wind
    value REAL, lo REAL, hi REAL,
    model TEXT, mae REAL, rmse REAL, confidence REAL
);
CREATE TABLE IF NOT EXISTS optimization_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    status TEXT,                   -- accepted / rejected / fallback
    method TEXT,                   -- lp / rule-based
    objective REAL,                -- expected diesel litres over horizon
    result_json TEXT
);
CREATE TABLE IF NOT EXISTS energy_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    ts REAL NOT NULL,
    start_offset_h REAL,
    hours REAL,
    diesel_kw REAL, battery_kw REAL, solar_kw REAL, wind_kw REAL,
    load_kw REAL, flexible_kw REAL
);
CREATE TABLE IF NOT EXISTS safety_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    rule TEXT, severity TEXT, passed INTEGER, detail TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    severity TEXT, code TEXT, title TEXT, message TEXT,
    acknowledged INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS operator_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    actor TEXT, action TEXT, params_json TEXT
);
CREATE TABLE IF NOT EXISTS resupply_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    resupply_date TEXT, expected_fuel_l REAL, note TEXT
);
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    source TEXT, event TEXT, detail TEXT, status TEXT
);
CREATE TABLE IF NOT EXISTS model_state (
    key TEXT PRIMARY KEY,
    value_json TEXT
);
"""


def get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
            _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.executescript(SCHEMA)
            _conn.commit()
        return _conn


@contextmanager
def tx():
    c = get_conn()
    with _lock:
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise


def insert(table: str, **values: Any) -> int:
    cols = ", ".join(values)
    qs = ", ".join("?" for _ in values)
    with tx() as c:
        cur = c.execute(f"INSERT INTO {table} ({cols}) VALUES ({qs})", tuple(values.values()))
        return int(cur.lastrowid)


def insert_many(table: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = list(rows[0].keys())
    qs = ", ".join("?" for _ in cols)
    with tx() as c:
        c.executemany(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({qs})",
            [tuple(r.get(k) for k in cols) for r in rows],
        )


def query(sql: str, params: tuple = ()) -> list[dict]:
    c = get_conn()
    with _lock:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def query_one(sql: str, params: tuple = ()) -> Optional[dict]:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> None:
    with tx() as c:
        c.execute(sql, params)


def j(obj: Any) -> str:
    return json.dumps(obj, default=str)


def log_event(source: str, event: str, detail: str = "", status: str = "info") -> None:
    insert("system_events", ts=time.time(), source=source, event=event,
           detail=detail, status=status)
