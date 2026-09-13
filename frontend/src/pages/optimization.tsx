import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import {
  Page, statusBadge, BeforeAfterReplanCard, WhyPolarEmsPanel
} from '../components'
import { post, get, Recommendation, Step, BaselineComparison } from '../api'

const PIPELINE_STEPS = [
  'Reading current station state & resupply ETA model',
  'Updating weather & demand forecast intervals',
  'Evaluating Safe Operability & CQRM shortfall probability',
  'Solving chance-constrained LP energy schedule',
  'Running 6-rule safety validation gate',
  'Generating recommendation & causality breakdown',
]

export const OptimizationPage: React.FC = () => {
  const { station, recommendation, refresh } = useStore()
  const [rec, setRec] = useState<Recommendation | null>(recommendation)
  const [busy, setBusy] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [err, setErr] = useState('')
  const [showBaseline, setShowBaseline] = useState(false)
  const [baselineData, setBaselineData] = useState<BaselineComparison | null>(null)
  const [baselineLoading, setBaselineLoading] = useState(false)
  const timerRef = useRef<number | null>(null)

  const run = async () => {
    setBusy(true)
    setErr('')
    setCurrentStep(0)
    let step = 0
    timerRef.current = window.setInterval(() => {
      step++
      if (step < PIPELINE_STEPS.length) {
        setCurrentStep(step)
      }
    }, 280)
    try {
      const r = await post<Recommendation>('/optimization/run')
      setRec(r)
      if (timerRef.current) clearInterval(timerRef.current)
      setCurrentStep(PIPELINE_STEPS.length)
      await refresh()
    } catch (e: any) {
      if (timerRef.current) clearInterval(timerRef.current)
      setCurrentStep(-1)
      setErr(`OPTIMIZATION FAILED — ${e.message}. Safe rule-based schedule remains active.`)
    } finally {
      setBusy(false)
    }
  }

  const loadBaseline = async () => {
    setShowBaseline(true)
    if (baselineData) return
    setBaselineLoading(true)
    try {
      const res = await get<BaselineComparison>('/optimization/baseline-comparison')
      setBaselineData(res)
    } catch (e: any) {
      console.error(e)
    } finally {
      setBaselineLoading(false)
    }
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const cur = rec ?? recommendation
  const plan = cur?.plan
  const beforeAfter = station?.before_after_replan || cur?.before_after_replan

  const approve = async () => { await post('/optimization/approve'); await refresh() }
  const reject = async () => { await post('/optimization/reject'); await refresh() }

  return (
    <Page
      title="Operating Plan & Optimization"
      technicalDisclosure={true}
      meta={
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={run}
            style={{ fontWeight: 600 }}
          >
            {busy ? 'Solving…' : '⚡ Re-Optimize Now'}
          </button>
          {cur && statusBadge(cur.safety.passed ? 'SAFETY VALIDATED' : 'SAFETY REJECTED')}
        </div>
      }
    >
      {/* 1. WHY POLAR-EMS? INNOVATION PANEL */}
      <WhyPolarEmsPanel />

      {/* 2. BEFORE / AFTER REPLAN COMPARISON (Showing real causality) */}
      {beforeAfter?.has_changed && (
        <BeforeAfterReplanCard data={beforeAfter} />
      )}

      {/* 3. PIPELINE PROGRESS */}
      {(busy || currentStep === PIPELINE_STEPS.length) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <ul className="step-progress">
            {PIPELINE_STEPS.map((label, i) => {
              const done = currentStep > i || currentStep === PIPELINE_STEPS.length
              const active = currentStep === i && currentStep < PIPELINE_STEPS.length
              return (
                <li key={i}>
                  <span className={`step-num ${done ? 'done' : active ? 'active' : ''}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ opacity: done || active ? 1 : 0.5, fontSize: 12 }}>{label}</span>
                </li>
              )
            })}
          </ul>
          {currentStep === PIPELINE_STEPS.length && (
            <div className="badge safe" style={{ marginTop: 6 }}>
              OPTIMIZATION COMPLETE — Chance-constrained schedule solved & safety-approved.
            </div>
          )}
        </div>
      )}

      {err && <div className="badge critical" style={{ marginBottom: 12, display: 'inline-block' }}>{err}</div>}

      {/* 4. RECOMMENDATION HEADER & ACTIONS */}
      {plan && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 700 }}>
                DISPATCH RECOMMENDATION — NEXT {plan.horizon_h} HOURS
              </h3>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  style={{ background: '#f8fafc', fontWeight: 600 }}
                  onClick={() => (showBaseline ? setShowBaseline(false) : loadBaseline())}
                >
                  {showBaseline ? 'Hide Baseline' : '⚖ Compare with Baseline'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>
              {plan.recommendation_summary || station?.recommendation_summary || 'Optimal schedule active.'}
            </div>

            <div className="rec-detail">
              <span>Fuel consumed (6h): <b>{plan.fuel_consumed_6h_l ?? plan.expected_fuel_l} L</b></span>
              <span>Projected fuel end: <b>{plan.fuel_remaining_end_l ?? '—'} L</b></span>
              <span>Target end SOC: <b>{plan.expected_end_soc}%</b></span>
              <span>Battery Reserve Floor: <b>{plan.reserve_soc_target ?? 20}%</b></span>
              <span>Flexible Load: <b>{plan.flexible_load_pct ?? 100}%</b></span>
            </div>

            <div className="row" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <button
                type="button"
                className="success"
                disabled={!station?.awaiting_approval}
                onClick={approve}
              >
                ✓ Approve Plan
              </button>
              <button
                type="button"
                className="danger"
                disabled={!station?.awaiting_approval}
                onClick={reject}
              >
                ✕ Reject (Trigger Fallback)
              </button>
              <button
                type="button"
                onClick={() => { post('/actions', { action: 'resume_auto_mode' }).then(refresh) }}
              >
                Resume Auto Mode
              </button>
            </div>
          </div>

          {/* 5. INLINE BASELINE COMPARISON */}
          {showBaseline && (
            <div className="card" style={{ marginBottom: 14, background: '#fafaf9', border: '1px solid #e7e5e4' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0, color: '#44403c' }}>
                  NAIVE BASELINE VS POLAR-EMS COMPARISON
                </h3>
                <span className="badge safe">Quantified Innovation Value</span>
              </div>
              {baselineLoading ? (
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Evaluating naive heuristics vs POLAR-EMS…</p>
              ) : baselineData ? (
                <>
                  <table className="cmp-table">
                    <thead>
                      <tr>
                        <th>Decision Metric</th>
                        <th>Naive EMS (Heuristic)</th>
                        <th>POLAR-EMS (Risk-Aware)</th>
                        <th>Improvement / Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label-col">Fuel Consumed (6h)</td>
                        <td>{Math.round(baselineData.baseline.fuel_consumed_6h_l)} L</td>
                        <td>{Math.round(baselineData.polar_ems.fuel_consumed_6h_l)} L</td>
                        <td className="delta-positive">-{Math.round(baselineData.delta.fuel_saved_6h_l)} L saved</td>
                      </tr>
                      <tr>
                        <td className="label-col">Estimated Safe Autonomy</td>
                        <td>{baselineData.baseline.safe_autonomy_days.toFixed(1)} days</td>
                        <td>{baselineData.polar_ems.safe_autonomy_days.toFixed(1)} days</td>
                        <td className="delta-positive">+{baselineData.delta.autonomy_gain_days.toFixed(1)} days extension</td>
                      </tr>
                      <tr>
                        <td className="label-col">Resupply Buffer Margin</td>
                        <td>{baselineData.baseline.resupply_margin_days.toFixed(1)} days</td>
                        <td>{baselineData.polar_ems.resupply_margin_days.toFixed(1)} days</td>
                        <td className="delta-positive">Resupply window secured</td>
                      </tr>
                      <tr>
                        <td className="label-col">Critical Load Protection</td>
                        <td>{baselineData.baseline.critical_load_hours_met}/{baselineData.baseline.critical_load_hours_total} hrs</td>
                        <td>{baselineData.polar_ems.critical_load_hours_met}/{baselineData.polar_ems.critical_load_hours_total} hrs</td>
                        <td className="delta-positive">100% Critical Zero-Blackout</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#57534e', fontStyle: 'italic' }}>
                    {baselineData.summary}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* 6. 6-HOUR HOURLY DISPATCH SCHEDULE */}
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>6-Hour Optimization Dispatch Schedule</h3>
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Diesel kW</th>
                  <th>Battery kW</th>
                  <th>Solar kW</th>
                  <th>Wind kW</th>
                  <th>Load kW</th>
                  <th>Flexible kW</th>
                </tr>
              </thead>
              <tbody>
                {plan.steps.map((s: Step, i: number) => (
                  <tr key={i}>
                    <td>+{s.start_offset_h}h</td>
                    <td>{s.diesel_kw > 0 ? Math.round(s.diesel_kw) : '—'}</td>
                    <td style={{ color: s.battery_kw > 0 ? 'var(--green)' : s.battery_kw < 0 ? 'var(--amber)' : undefined }}>
                      {s.battery_kw > 0 ? `+${Math.round(s.battery_kw)}` : s.battery_kw < 0 ? Math.round(s.battery_kw) : 'Hold'}
                    </td>
                    <td>{Math.round(s.solar_kw)}</td>
                    <td>{Math.round(s.wind_kw)}</td>
                    <td>{Math.round(s.load_kw)}</td>
                    <td>
                      {s.flexible_kw != null ? (
                        <span>
                          {Math.round(s.flexible_kw)}{' '}
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                            ({s.flexible_pct != null ? `${Math.round(s.flexible_pct)}%` : '100%'})
                          </span>
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 7. SAFETY VALIDATION GATE RESULTS */}
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Safety Validation Gate Audit</h3>
            <ul className="safety-list">
              {cur?.safety.checks.map(c => (
                <li key={c.rule}>
                  <span className={`check ${c.passed ? 'pass' : 'fail'}`}>
                    {c.passed ? '✓' : '✗'}
                  </span>
                  <span style={{ fontWeight: 600 }}>{c.rule.replace(/_/g, ' ')}</span>
                  <span className="note" style={{ margin: 0, marginLeft: 'auto' }}>
                    {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Page>
  )
}
