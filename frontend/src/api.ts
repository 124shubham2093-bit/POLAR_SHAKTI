/** Minimal typed API client for the POLAR-EMS backend. */

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export const get = <T,>(path: string) => req<T>(path)
export const post = <T,>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })

export interface ScenarioV1Response {
  scenario: string
  safe_operability_days: number
  cqrm_days: number
  risk_level: 'SAFE' | 'CAUTION' | 'CONSERVE' | 'CRITICAL' | string
  required_reserve_soc_pct: number
  optimizer_status: string
  safety_status: 'SAFE' | 'UNSAFE' | string
  final_decision: 'ACCEPT_PLAN' | 'REJECT_PLAN' | string
  operating_mode: 'NORMAL' | 'CONSERVATION' | string
  operator_intervention_required: boolean
  resupply_p10_days: number
  resupply_p50_days: number
  resupply_p90_days: number
  resupply_margin_days: number
  recommended_action: string
  reason: string
  violations: any[]
  initial_battery_soc_pct?: number
  final_battery_soc_pct?: number
  initial_fuel_l?: number
  final_fuel_l?: number
  fuel_used_l?: number
  generator_energy_kwh?: number
  renewable_used_kwh?: number
  renewable_curtailed_kwh?: number
  battery_discharge_kwh?: number
  battery_charge_kwh?: number
  first_violation?: { timestamp: string; violations: string[] }
  hourly_plan?: any[]
}

export const runScenarioV1 = (scenario: string, delayDays: number = 0.0) =>
  post<ScenarioV1Response>('/v1/scenario/run', { scenario, delay_days: delayDays })

// ---------------------------------------------------------------- types ----
export interface ResupplyDailyProb {
  day: number
  marginal_probability: number
  cumulative_arrival_probability: number
}

export interface ResupplyModel {
  scheduled_base_days: number
  slider_delay_days: number
  expected_days: number
  conservative_days: number
  optimistic_days: number
  confidence_level: number
  weather_delay_factor_days: number
  weather_impact: string
  primary_uncertainty: string
  daily_distribution: ResupplyDailyProb[]
  data_status: string
}

export interface Autonomy {
  safe_autonomy_days: number
  conservative_days: number
  expected_days: number
  optimistic_days: number
  confidence: number
  failure_probability_before_resupply: number
  next_resupply_days: number
  resupply_conservative_days?: number
  autonomy_margin_days: number
  cqrm_margin_days: number
  status: 'SAFE' | 'CAUTION' | 'CONSERVE' | 'CRITICAL' | string
  interpretation: string
  methodology: string
  assumptions: Record<string, unknown>
  resupply_model?: ResupplyModel
}

export interface BeforeAfterSnapshot {
  battery_kw: number
  diesel_kw: number
  flexible_load_pct: number
  reserve_soc_pct: number
}

export interface BeforeAfterReplan {
  has_changed: boolean
  trigger: string
  trigger_description: string
  before: BeforeAfterSnapshot
  after: BeforeAfterSnapshot
  reason: string
  result: string
  safe_operability_days: number
  margin_days: number
  shortfall_risk_pct: number
  timestamp: number
}

export interface WhatChanged {
  metric: string
  direction: 'up' | 'down' | 'neutral'
  detail: string
}

export interface DemoState {
  active: boolean
  step: number
  total_steps: number
  name: string
  badge?: string
  description?: string
  paused: boolean
}

export interface Station {
  station: { id: string; name: string; simulation: boolean }
  sim_time_h: number
  fuel_l: number
  fuel_pct: number
  battery_soc: number
  battery_soh: number
  battery_power_kw: number
  generator_running: boolean
  generator_output_kw: number
  generator_failed: boolean
  loads: { critical_kw: number; essential_kw: number; flexible_kw: number; total_kw: number; flexible_shed_pct: number }
  weather: { temperature_c: number; wind_speed_ms: number; solar_irradiance_wm2: number; condition: string }
  scenario: Record<string, boolean>
  connectivity: { internet: string; mqtt: string; cloud: string; sync_queue: number }
  mode: string
  mode_auto: boolean
  resupply: {
    in_days: number
    delay_days?: number
    expected_fuel_l: number
    model?: ResupplyModel
  }
  engines: Record<string, string>
  data_quality: { score: number; issues: string[] }
  balance: { solar_kw: number; wind_kw: number; battery_kw: number; diesel_kw: number; load_kw: number; heating_kw: number }
  autonomy: Autonomy
  latest_forecast: Forecast
  safety: SafetyResult
  awaiting_approval: boolean
  recommendation?: Recommendation
  recommendation_summary: string
  what_changed?: WhatChanged[]
  before_after_replan?: BeforeAfterReplan
  demo_state?: DemoState
}

export interface Step {
  start_offset_h: number
  hours: number
  diesel_kw: number
  battery_kw: number
  solar_kw: number
  wind_kw: number
  load_kw: number
  flexible_kw: number
  flexible_pct?: number
}

export interface SafetyResult {
  passed: boolean
  checks: { rule: string; passed: boolean; detail: string }[]
}

export interface Recommendation {
  trigger: string
  status: string
  plan: {
    horizon_h: number
    steps: Step[]
    expected_fuel_l: number
    fuel_consumed_6h_l: number
    fuel_remaining_end_l: number
    expected_end_soc: number
    method: string
    recommendation_summary: string
    reserve_soc_target?: number
    flexible_load_pct?: number
  }
  safety: SafetyResult
  autonomy: Autonomy
  explanations: { question: string; reason_lines: string[]; safety_impact?: string; expected_fuel_saving_l?: number; expected_fuel_use_l?: number }[]
  what_changed?: WhatChanged[]
  before_after_replan?: BeforeAfterReplan
  awaiting_approval: boolean
}

export interface Forecast {
  targets: Record<string, { steps: Record<string, { value: number; lo: number; hi: number }>; model: string }>
  generated_at: number
}

export interface Alert {
  id: number
  ts: number
  severity: string
  code: string
  title: string
  message: string
  acknowledged: number
  occurrences: number
}

export interface SysEvent { ts: number; source: string; event: string; detail: string; status: string }

export interface BaselineComparison {
  baseline: {
    method: string
    fuel_consumed_6h_l: number
    fuel_remaining_end_l: number
    end_soc: number
    renewable_utilised_kw_avg: number
    diesel_avg_kw: number
    critical_load_hours_met: number
    critical_load_hours_total: number
    safe_autonomy_days: number
    resupply_margin_days: number
  }
  polar_ems: {
    method: string
    fuel_consumed_6h_l: number
    fuel_remaining_end_l: number
    end_soc: number
    renewable_utilised_kw_avg: number
    diesel_avg_kw: number
    critical_load_hours_met: number
    critical_load_hours_total: number
    safe_autonomy_days: number
    resupply_margin_days: number
    safety_validated: boolean
  }
  delta: {
    fuel_saved_6h_l: number
    autonomy_gain_days: number
    end_soc_improvement_pct: number
    renewable_utilisation_improvement_kw: number
    early_warning_advantage_h: number
    early_warning_advantage_days: number
  }
  warning_lead_time: {
    baseline_first_warning_h: number
    polar_ems_first_warning_h: number
    baseline_first_warning_days: number
    polar_ems_first_warning_days: number
    early_warning_advantage_h: number
    early_warning_advantage_days: number
  }
  summary: string
}
