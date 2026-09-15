# POLAR-EMS — Autonomy-Aware Polar Energy Management System

**SIMULATION / DEMONSTRATION DATA** — the simulated station "MAITRI SIMULATION" is fictional.
This project is not connected to, and makes no claims about, any real Antarctic station or
real Maitri station operations.

POLAR-EMS is a complete, offline-first energy **management** system for polar research
stations. Its central question is not "how do we minimize fuel?" but:

> **Can the station safely operate until the next resupply — and what operating strategy
> gives the safest, most efficient path to that resupply?**

It runs as a web application today and is architected to be packaged later as an Electron
desktop application (React UI + local FastAPI service layer + local ML + local optimizer +
local SQLite database + local safety engine).

---

## What it does (the decision chain)

```
SENSORS (simulated) → INGESTION (MQTT-style bus) → VALIDATION (quality engine)
  → FORECASTING (local ridge regression + uncertainty intervals)
  → AUTONOMY ENGINE (safe-autonomy projection vs resupply horizon)
  → OPTIMIZATION (LP schedule: battery/diesel/flexible loads)
  → SAFETY VALIDATION (rules; reject → safe fallback)
  → RECOMMENDATION + EXPLANATIONS → OPERATOR (approve/reject)
  → ENERGY SYSTEM SIMULATION → FEEDBACK → repeat
```

Change any input (temperature, fuel, resupply date, internet state, generator availability)
and the whole chain recalculates — every engine shares one live `SystemState`.

## Modules

| Module | What it provides |
| --- | --- |
| Overview / Operations | Decision-first home: state → safe autonomy → resupply risk → forecast → recommended action → safety approval |
| Live Monitoring | Physically-coupled live simulation (temperature↔heating↔load, irradiance↔solar, wind↔generation, diesel↔fuel) |
| Data Management | Raw/cleaned readings, data-quality score, MQTT topic health, operator audit trail |
| Forecasting | 1/6/24-h forecasts for load/solar/wind with prediction intervals, honest MAE/RMSE, model management |
| Autonomy | Estimated safe autonomy, margin vs resupply, documented methodology |
| Energy Optimization | Run optimization, view schedule, safety result, "why?" explanations, approve/reject |
| Safety & Critical Loads | Configurable rules, load priorities (critical/essential/flexible), latest validation |
| Resupply Planning | Configure resupply date/fuel; autonomy vs required-horizon gap analysis |
| Scenario Simulator | 8 scenarios + master demo (storm + internet loss + resupply risk) |
| Alerts & Events | Condition-based alerts (INFO→EMERGENCY) + persisted event log |
| Historical Analytics | Load/SOC/solar/wind trends over 24 h / 7 d / 30 d, optimization-run history |
| System Health | Engine statuses, graceful-degradation state, offline-first info, roles |
| Settings / Operator Actions | Mode override, plant overrides, full auditability |

## Quick start (one command)

```bash
docker compose up --build
```

Then open http://localhost:8080 (frontend) — the API is at http://localhost:8321/docs.

## Running locally (no Docker)

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows
# .venv/bin/pip install -r requirements.txt        # Linux/macOS
.venv/Scripts/python -m uvicorn app.main:app --port 8321
```

On startup the backend seeds 30 days of coherent simulated history (labelled SIMULATION
DATA), trains the local forecasting model, runs the decision pipeline and starts the
background simulation loop. Delete `data/polarems.db` to regenerate.

**Frontend:**

```bash
cd frontend
npm install
npm run dev            # dev server on :5173, proxies /api to :8321
# or for production:
npm run build          # output in dist/, served automatically by FastAPI at :8321
```

## The demo flow (hackathon)

Open **Scenario Simulator → START DEMO**. Over ~56 s the system walks through:

1. NORMAL OPERATION (fuel 8,420 L, battery 62%, resupply in 6 d)
2. WEATHER DETERIORATION (temperature drops, wind/solar degrade)
3. HEATING DEMAND ↑ + RENEWABLE UNCERTAINTY ↑
4. AUTONOMY FALLS → RESUPPLY RISK (mode changes automatically)
5. OPTIMIZATION + SAFETY VALIDATION (new schedule, reserve widening)
6. INTERNET FAILURE (cloud unavailable; **all local engines continue**)
7. NEW SAFE SCHEDULE under local operation

Watch the autonomy hero number, mode badge, alerts and recommended plan react live.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full pipeline, engine descriptions,
autonomy methodology, database schema and Electron-packaging plan.

## API structure

```
/health                       health check and loaded ML model summary
/api/v1/scenario/run          canonical resupply-conditioned scenario runner
/api/v1/scenario/list         list supported stress scenarios
/api/station                  live shared-state snapshot
/api/sensors                  readings, quality, MQTT health, REST ingest
/api/weather                  current, history, weather→impact translation
/api/forecast                 forecasts, model info, retrain, update simulation
/api/autonomy                 safe autonomy + methodology
/api/optimization             run/approve/reject + latest recommendation
/api/safety                   rules + latest validation
/api/resupply                 configure resupply, required-horizon gap
/api/scenarios                activate scenarios, demo start/stop
/api/alerts                   list/acknowledge
/api/events                   persisted system event log
/api/system                   engine health
/api/connectivity             internet loss/restore simulation, sync queue
/api/data                     readings/forecasts/schedules/actions for data page
/api/actions                  operator actions (all audited)
/api/models                   model management
```

## Resupply-Aware Decision Chain (Validated Pipeline)

```
Station Telemetry / Scenario State
        ↓
Data Validation
        ↓
Forecasting (Load 20-feat, Solar 12-feat, Wind 17-feat)
        ↓
Uncertainty / Risk Inputs
        ↓
Battery State (SOH 8-feat) & SCADA Anomaly (23-feat)
        ↓
Resupply Modeling (P10 / P50 / P90)
        ↓
Safe Operability (30-day Forward Simulation)
        ↓
CQRM (Cumulative Quantile Risk Metric = Safe Operability − P90 Resupply)
        ↓
Dynamic Reserve Policy (20% to 85% SOC)
        ↓
Optimization (HiGHS LP optimize_station_v3)
        ↓
Deterministic Safety Validator (Model-7 Authoritative Hard Constraints)
        ↓
Final Operational Decision (ACCEPT_PLAN / REJECT_PLAN)
        ↓
Operator UI / Audit Trail
```

## Honest Scope & Positioning

- Core differentiator: **Resupply-Aware, Weather/Logistics-Conditioned Energy Dispatch**.
- Core safety and decision functions do **not** depend on continuous external connectivity.
- The Optimizer recommends; the Deterministic Safety Validator has final authority; the Operator remains responsible for approval.
- Hardware protections remain separate from the software decision layer.
- All prototype assumptions (e.g. 3.0 kWh/L diesel conversion) are explicit and configurable.

