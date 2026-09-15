import React, { useState, useEffect } from 'react'
import { runScenarioV1, ScenarioV1Response } from '../api'
import { Page, statusBadge } from '../components'
import { useStore } from '../store'

export const ScenariosPage: React.FC = () => {
  const { station, refresh } = useStore()
  const [selectedScenario, setSelectedScenario] = useState<string>('NORMAL')
  const [scenarioResult, setScenarioResult] = useState<ScenarioV1Response | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const scenariosList = [
    {
      id: 'NORMAL',
      label: '1. NORMAL OPERATIONS',
      badge: 'NOMINAL',
      badgeClass: 'safe',
      desc: 'Nominal load, typical polar renewables, standard resupply envelope (+0.49 d CQRM). Plan is ACCEPTED.'
    },
    {
      id: 'RESUPPLY_DELAY_4D',
      label: '2. RESUPPLY DELAY (+4 DAYS)',
      badge: 'LOGISTICS STRESS',
      badgeClass: 'danger',
      desc: 'Convoy delayed 4 days. CQRM drops to -3.51 d (CRITICAL). Reserve requirement rises to 76.8% SOC. Safety Validator REJECTS plan.'
    },
    {
      id: 'STORM',
      label: '3. ANTARCTIC STORM',
      badge: 'WEATHER SEVERE',
      badgeClass: 'danger',
      desc: 'Severe gale drops wind to 45% & solar to 65%. Safe operability shrinks to 5.58 d. Optimizer becomes INFEASIBLE. Plan REJECTED.'
    },
    {
      id: 'LOW_RENEWABLE',
      label: '4. LOW RENEWABLE PERIOD',
      badge: 'EXTENDED CALM',
      badgeClass: 'caution',
      desc: 'Prolonged overcast and calm (60% wind, 50% solar). Operability 6.12 d. CQRM -4.18 d. Plan REJECTED.'
    },
    {
      id: 'BATTERY_DEGRADATION',
      label: '5. BATTERY DEGRADATION (75% SOH)',
      badge: 'HARDWARE WEAR',
      badgeClass: 'caution',
      desc: 'SOH falls to 75% (~863 kWh usable capacity). Optimizer compensates with more generator energy. Safety validates SAFE.'
    },
    {
      id: 'SCADA_ANOMALY',
      label: '6. SCADA ANOMALY DETECTED',
      badge: 'EARLY WARNING',
      badgeClass: 'caution',
      desc: 'Isolation Forest flags abnormal turbine vibration/voltage behavior. Generator capacity derated 25% for stress assessment.'
    },
    {
      id: 'COMMUNICATION_LOSS',
      label: '7. COMMUNICATION LOSS',
      badge: 'OFFLINE AUTONOMY',
      badgeClass: 'info',
      desc: 'External satellite link disconnected. Core dispatch, forecasting, LP optimization, and safety engine continue in LOCAL mode.'
    }
  ]

  const executeScenario = async (id: string) => {
    setLoading(true)
    setError(null)
    setSelectedScenario(id)
    try {
      const delay = id === 'RESUPPLY_DELAY_4D' ? 4.0 : 0.0
      const res = await runScenarioV1(id, delay)
      setScenarioResult(res)
      localStorage.setItem('polar_ems_active_scenario', id)
      localStorage.setItem('polar_ems_scenario_result', JSON.stringify(res))
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to execute scenario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('polar_ems_active_scenario') || 'NORMAL'
    executeScenario(saved)
  }, [])

  return (
    <Page
      title="Scenario Simulator & Resupply-Aware Stress Testing"
      technicalDisclosure={true}
      meta={scenarioResult && (
        <span className={`badge ${scenarioResult.final_decision === 'ACCEPT_PLAN' ? 'safe' : 'danger'}`}>
          {scenarioResult.final_decision} · {scenarioResult.operating_mode}
        </span>
      )}
    >
      {/* 1. SCENARIO SELECTOR CARDS */}
      <div className="section">
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700, color: 'var(--text)' }}>
          SELECT AN OPERATIONAL STRESS SCENARIO
        </h3>
        <div className="grid g3" style={{ marginBottom: 16 }}>
          {scenariosList.slice(0, 3).map((sc) => (
            <div
              key={sc.id}
              className="card"
              style={{
                borderTop: selectedScenario === sc.id ? '4px solid var(--blue)' : '4px solid var(--border)',
                background: selectedScenario === sc.id ? 'rgba(56, 189, 248, 0.05)' : undefined,
                cursor: 'pointer'
              }}
              onClick={() => executeScenario(sc.id)}
            >
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{sc.label}</h4>
                <span className={`badge ${sc.badgeClass}`}>{sc.badge}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, minHeight: 48 }}>
                {sc.desc}
              </p>
              <button
                type="button"
                className={selectedScenario === sc.id ? 'primary' : ''}
                disabled={loading}
                style={{ width: '100%', fontWeight: 600 }}
              >
                {selectedScenario === sc.id && loading ? 'Simulating…' : selectedScenario === sc.id ? '✓ Active Scenario' : 'Run Scenario'}
              </button>
            </div>
          ))}
        </div>

        <div className="grid g4">
          {scenariosList.slice(3).map((sc) => (
            <div
              key={sc.id}
              className="card"
              style={{
                borderTop: selectedScenario === sc.id ? '4px solid var(--blue)' : '4px solid var(--border)',
                background: selectedScenario === sc.id ? 'rgba(56, 189, 248, 0.05)' : undefined,
                cursor: 'pointer'
              }}
              onClick={() => executeScenario(sc.id)}
            >
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{sc.label}</h4>
                <span className={`badge ${sc.badgeClass}`} style={{ fontSize: 10 }}>{sc.badge}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, minHeight: 40 }}>
                {sc.desc}
              </p>
              <button
                type="button"
                className={selectedScenario === sc.id ? 'primary' : ''}
                disabled={loading}
                style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
              >
                {selectedScenario === sc.id ? '✓ Selected' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginTop: 16 }}>
          <b style={{ color: 'var(--danger)' }}>Scenario Error:</b> {error}
        </div>
      )}

      {/* 2. REAL-TIME VALIDATED DECISION OUTPUT */}
      {scenarioResult && (
        <div className="section" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700, color: 'var(--text)' }}>
            VALIDATED SCENARIO OUTCOME: {scenarioResult.scenario}
          </h3>

          {/* KPI GRID */}
          <div className="grid g4" style={{ marginBottom: 16 }}>
            {/* Safe Operability */}
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>SAFE OPERABILITY</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: scenarioResult.safe_operability_days < 7 ? 'var(--danger)' : 'var(--blue)', marginTop: 4 }}>
                {scenarioResult.safe_operability_days.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 500 }}>days</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Forward 30d physical simulation
              </div>
            </div>

            {/* CQRM Margin */}
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>CQRM (RESUPPLY MARGIN)</div>
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                color: scenarioResult.cqrm_days < 0 ? 'var(--danger)' : scenarioResult.cqrm_days < 2 ? 'var(--amber)' : 'var(--green)',
                marginTop: 4
              }}>
                {scenarioResult.cqrm_days > 0 ? `+${scenarioResult.cqrm_days.toFixed(2)}` : scenarioResult.cqrm_days.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 500 }}>days</span>
              </div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                <span className={`badge ${
                  scenarioResult.risk_level === 'SAFE' ? 'safe' :
                  scenarioResult.risk_level === 'CAUTION' ? 'caution' :
                  scenarioResult.risk_level === 'CONSERVE' ? 'conserve' : 'danger'
                }`}>
                  {scenarioResult.risk_level} RISK
                </span>
                <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>vs P90 ({scenarioResult.resupply_p90_days.toFixed(1)}d)</span>
              </div>
            </div>

            {/* Reserve Policy */}
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>DYNAMIC RESERVE SOC</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--purple)', marginTop: 4 }}>
                {scenarioResult.required_reserve_soc_pct.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Optimizer status: <b style={{ color: scenarioResult.optimizer_status === 'OPTIMAL' ? 'var(--green)' : 'var(--danger)' }}>{scenarioResult.optimizer_status}</b>
              </div>
            </div>

            {/* Authoritative Decision */}
            <div className="card" style={{ borderLeft: scenarioResult.final_decision === 'ACCEPT_PLAN' ? '4px solid var(--green)' : '4px solid var(--danger)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>FINAL OPERATIONAL DECISION</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: scenarioResult.final_decision === 'ACCEPT_PLAN' ? 'var(--green)' : 'var(--danger)', marginTop: 4 }}>
                {scenarioResult.final_decision}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Safety: <b style={{ color: scenarioResult.safety_status === 'SAFE' ? 'var(--green)' : 'var(--danger)' }}>{scenarioResult.safety_status}</b> · {scenarioResult.operating_mode}
              </div>
            </div>
          </div>

          {/* DETAILED ACTION & SAFETY AUDIT */}
          <div className="grid g2">
            {/* Recommended Action & Reason */}
            <div className="card">
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                RECOMMENDED OPERATIONAL ACTION
              </h4>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                {scenarioResult.recommended_action}
              </p>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
                <b>Rationale:</b> {scenarioResult.reason}
              </div>
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <b>Operator Intervention:</b>{' '}
                <span className={`badge ${scenarioResult.operator_intervention_required ? 'danger' : 'safe'}`}>
                  {scenarioResult.operator_intervention_required ? 'REQUIRED (APPROVAL MANDATORY)' : 'NOT REQUIRED (WITHIN CONSTRAINTS)'}
                </span>
              </div>
            </div>

            {/* Deterministic Safety Validator Audit */}
            <div className="card">
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                DETERMINISTIC SAFETY VALIDATOR AUDIT
              </h4>
              {scenarioResult.violations && scenarioResult.violations.length > 0 ? (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 8px' }}>
                    ⚠️ {scenarioResult.violations.length} Deterministic Safety Violation(s) Detected:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {scenarioResult.violations.map((v, i) => (
                      <li key={i} style={{ color: 'var(--danger)', marginBottom: 4 }}>
                        <code>{typeof v === 'string' ? v : v.code || JSON.stringify(v)}</code>
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                    Rule: Deterministic Safety Validator has final authority. Safety violations cannot be overridden by ML risk estimates.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--green)', margin: '0 0 8px' }}>
                    ✓ All Model-7 deterministic safety constraints verified and satisfied:
                  </p>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    • Min Battery SOC: &ge; 20.0% (Simulated: {scenarioResult.final_battery_soc_pct ?? scenarioResult.initial_battery_soc_pct}%)<br />
                    • Fuel Reserve: &ge; 800 L (Final remaining: {scenarioResult.final_fuel_l ?? scenarioResult.initial_fuel_l} L)<br />
                    • Critical Load Coverage: 100%<br />
                    • Power Balance Error: &le; 5 kW tolerance<br />
                    • Resupply Margin: &ge; 0.0 days (CQRM: +{scenarioResult.cqrm_days.toFixed(2)} d)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DISPATCH SUMMARY STRIP */}
          {scenarioResult.optimizer_status === 'OPTIMAL' && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>
                OPTIMIZED 7-DAY DISPATCH SUMMARY
              </h4>
              <div className="grid g6" style={{ textAlign: 'center', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>GENERATOR ENERGY</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber)', marginTop: 2 }}>
                    {scenarioResult.generator_energy_kwh?.toFixed(1)} kWh
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>DIESEL FUEL USED</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber)', marginTop: 2 }}>
                    {scenarioResult.fuel_used_l?.toFixed(1)} L
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>RENEWABLES USED</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>
                    {scenarioResult.renewable_used_kwh?.toFixed(1)} kWh
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>CURTAILMENT</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginTop: 2 }}>
                    {scenarioResult.renewable_curtailed_kwh?.toFixed(1)} kWh
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>BATTERY DISCHARGE</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>
                    {scenarioResult.battery_discharge_kwh?.toFixed(1)} kWh
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>FINAL BATTERY SOC</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple)', marginTop: 2 }}>
                    {scenarioResult.final_battery_soc_pct?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}
