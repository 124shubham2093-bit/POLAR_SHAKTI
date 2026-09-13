# POLAR-EMS — System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            ELECTRON (future)                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  React UI  (frontend/src — 13 modules, one shared store)           │  │
│  └───────────────▲────────────────────────────────────────────────────┘  │
│                  │ /api (HTTP, same-origin)                              │
│  ┌───────────────┴────────────────────────────────────────────────────┐  │
│  │  FastAPI service layer (backend/app/api — thin routers)            │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  ENGINES (backend/app/engines — pure business logic)               │  │
│  │   ingestion → validation → forecast → autonomy → optimizer         │  │
│  │            → safety → decision → alerts → scenarios                │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  SHARED SystemState (state/system_state.py — single source of      │  │
│  │  truth; every engine reads/writes it under one lock)               │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  SIMULATION (sim/weather.py, sim/plant.py, sim/loop.py, seed.py)   │  │
│  │  ← replaceable with real sensor feeds (REST/MQTT/CSV)              │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  SQLite (data/polarems.db — 16 tables, full audit trail)           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  Cloud (OPTIONAL): sync, backup, remote monitoring, model updates        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 1. Design principles

1. **One shared state.** All engines operate on a single `SystemState` instance. Any
   change (weather, fuel, resupply date, connectivity, faults) immediately affects
   forecasting inputs, autonomy projection, optimizer constraints, safety rules and
   alerts — the system-wide consistency requirement.
2. **Optimizer never controls the station.** Every plan passes the safety validation
   engine before reaching the operator or the simulation dispatch.
3. **Local-first.** Forecasting (ridge regression via numpy), optimization (scipy LP),
   autonomy, safety, storage (SQLite) and UI all run locally. Internet loss disables
   only optional cloud features.
4. **Graceful degradation.** ML failure → persistence fallback forecast. LP failure →
   deterministic rule-based schedule. Sensor anomaly → flagged + last-known-good
   fallback. Cloud failure → no impact on core operation.
5. **Honesty.** Simulated data is labelled; model metrics are measured, not asserted;
   autonomy is labelled "ESTIMATED SAFE AUTONOMY" with documented methodology.

## 2. Data flow per decision cycle (`engines/decision.py`)

```
forecast.forecast()          # ridge model → point + [lo, hi] per horizon
autonomy.calculate()         # hour-by-hour projection → safe autonomy days
optimizer.optimize()         # scipy linprog 6-h schedule (battery/diesel)
safety.validate(plan)        # 5 rules: battery reserve, fuel reserve,
                             # critical load, generator limits, headroom
if rejected → optimizer._rule_based_schedule() + alert
recommendation = {plan, safety, explanations, autonomy} → persisted
```

Triggered on: startup, every ~30 s by the sim loop, any scenario activation,
any operator action, or manual "Run Optimization".

## 3. Autonomy methodology (the core differentiator)

`engines/autonomy.py` projects hour by hour:

- **Demand**: forecasted load (with diurnal modulation) including heating demand
  coupled to forecast temperature.
- **Renewables**: forecast solar + wind at the **low end of the prediction interval**
  (P10) — uncertainty widens under storm/overcast conditions.
- **Battery**: discharged only above the configurable reserve SOC (30% default);
  surpluses recharge it.
- **Fuel**: diesel covers residual demand at a specific consumption of 0.28 L/kWh,
  minus the fuel reserve (15% of usable capacity).
- **Termination**: autonomy ends when fuel below reserve can no longer cover the
  residual load. The result is days of *safe* operation, compared against the
  resupply horizon → margin → status (SAFE / RESUPPLY RISK / CRITICAL / EMERGENCY)
  → operating mode (automatic, overridable).

Fuel ÷ current consumption is deliberately **not** used.

## 4. Safety rules (configurable, `config.py`)

| Rule | Default | Effect when violated |
| --- | --- | --- |
| min_battery_soc | 30 % | plan rejected → fallback strategy |
| emergency_battery_soc | 20 % | EMERGENCY mode |
| min_fuel_reserve_pct | 15 % | plan rejected; <8 % → EMERGENCY |
| generator_max_kw | 500 kW | plan rejected if exceeded |
| critical_load_kw | 72 kW | never shed; must be served every hour |
| uncertainty reserve | up to 15 % | widens required reserves |

## 5. Simulation model (physically coupled)

- Temperature: diurnal + 72-h synoptic cycle (−10 °C under storm scenarios).
- Heating demand: `30 + 2.6·max(0, −T−10) + 0.35·max(0, wind−8)` kW → essential load.
- Solar: irradiance × panel efficiency (cold-weather bonus), capped at 120 kW.
- Wind: cubic power curve, cut-in 3 m/s, rated 12 m/s, cut-out (storm lock) 25 m/s.
- Battery: charge/discharge efficiencies 0.95, limits 300/350 kW, SOC integrates
  energy exactly.
- Diesel: 0.28 L/kWh, min stable 50 kW, burns fuel from tank.
- Energy balance enforced every tick: `solar + wind + discharge + diesel = load + charge + losses`.

## 6. Database (SQLite, `data/polarems.db`)

`stations, sensor_readings, weather_data, battery_state, generator_state,
fuel_state, forecasts, optimization_runs, energy_schedules, safety_events,
alerts, operator_actions, resupply_events, system_events, model_state` —
every important event carries `timestamp, source, value/state, status`.

## 7. Forecasting engine

- Ridge regression (closed-form, numpy) per target: `load_kw`, `solar_kw`, `wind_kw`.
- Features: cyclic hour-of-day (×2 harmonics), temperature, wind, irradiance,
  weekly-synoptic cyclic terms.
- Trained on the station's own stored history (seeded simulation data).
- Validation: last 20 % time-based hold-out → reported **MAE / RMSE**.
- Intervals: point ± 1.28σ residuals (~90 %), widened ×1.4–1.8 under storms.
- Fallback: persistence heuristic with wide intervals, flagged in UI/System Health.

## 8. Optimization engine

- Horizon: 6 h hourly. Variables per hour: charge, discharge, diesel.
- Objective: minimize diesel fuel (L).
- Constraints: hourly energy balance (equality, against high-end load and low-end
  renewables), cumulative SOC ≥ reserve, generator bounds, variable bounds.
- Solver: scipy `linprog` (HiGHS). Failure → deterministic rule-based safe strategy
  (renewables → battery → diesel, flexible loads shed 60 % under risk).

## 9. Connectivity / offline behavior

`SIMULATE INTERNET LOSS` (UI or `/api/connectivity/simulate-loss`):
internet → OFFLINE, cloud → UNAVAILABLE, sync queue grows; data/ML/optimization/
safety/autonomy engines stay ACTIVE; dashboard keeps updating. On restore:
`247 records synchronized · 3 operational events uploaded · model update available`.

## 10. Electron packaging (future)

The app already runs as one local process serving the built UI. Packaging plan:
Electron main process spawns the FastAPI service (or a PyInstaller-frozen binary),
loads `localhost` UI; all engines, ML, optimizer, safety and SQLite remain local;
cloud stays optional. No browser-only dependencies exist today.

## 11. Docker

`docker-compose.yml`: `frontend` (nginx serving built UI, proxying `/api`),
`backend` (uvicorn), `mqtt` (eclipse-mosquitto, optional ingest path), volumes for
the SQLite database. `docker compose up --build` → http://localhost:8080.
