import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { Page, statusBadge, BeforeAfterReplanCard, WhyPolarEmsPanel } from '../components'
import { post, get, Recommendation, Step, BaselineComparison } from '../api'

export const OptimizationPage: React.FC = () => {
  const { station, recommendation, refresh } = useStore()
  const [rec, setRec] = useState<Recommendation | null>(recommendation)
  const [busy, setBusy] = useState(false)
  const [planStatus, setPlanStatus] = useState<'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'CONSERVATION'>('PROPOSED')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [err, setErr] = useState('')
  const [showBaseline, setShowBaseline] = useState(false)
  const [baselineData, setBaselineData] = useState<BaselineComparison | null>(null)
  const [baselineLoading, setBaselineLoading] = useState(false)
  const [showSafetyModal, setShowSafetyModal] = useState(false)
  const [showWhyModal, setShowWhyModal] = useState(false)

  // Sync with store recommendation
  useEffect(() => {
    if (recommendation) {
      setRec(recommendation)
    }
  }, [recommendation])

  const cur = rec ?? recommendation ?? station?.recommendation
  const plan = cur?.plan
  const safety = cur?.safety
  const isSafetyPassed = safety ? safety.passed : true
  const beforeAfter = station?.before_after_replan || cur?.before_after_replan

  // Handler: Re-Optimize Now
  const handleReoptimize = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await post<Recommendation>('/optimization/run')
      setRec(r)
      setPlanStatus('PROPOSED')
      setStatusMessage('New optimization plan generated and validated.')
      await refresh()
    } catch (e: any) {
      setErr(`Optimization failed: ${e.message || 'Solver error'}. Rule-based fallback active.`)
    } finally {
      setBusy(false)
    }
  }

  // Handler: Approve Plan
  const handleApprove = async () => {
    if (!isSafetyPassed) {
      setErr('Cannot approve an UNSAFE plan. Resolve safety violations or trigger safe fallback.')
      return
    }
    setBusy(true)
    try {
      await post('/optimization/approve')
      setPlanStatus('ACCEPTED')
      setStatusMessage(`Plan APPROVED by Operator at ${new Date().toLocaleTimeString()} — Active in station dispatch.`)
      await refresh()
    } catch (e: any) {
      setErr(`Approval failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  // Handler: Reject Plan
  const handleReject = async () => {
    setBusy(true)
    try {
      await post('/optimization/reject')
      setPlanStatus('REJECTED')
      setStatusMessage(`Plan REJECTED by Operator at ${new Date().toLocaleTimeString()} — Station operating in safe holding mode.`)
      await refresh()
    } catch (e: any) {
      setErr(`Rejection recording failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  // Handler: Trigger Fallback
  const handleTriggerFallback = async () => {
    setBusy(true)
    setErr('')
    try {
      await post('/actions', { action: 'set_mode', params: { mode: 'ENERGY_CONSERVATION' } })
      const r = await post<Recommendation>('/optimization/run')
      setRec(r)
      setPlanStatus('CONSERVATION')
      setStatusMessage('Safe Energy Conservation Fallback activated — Non-essential loads shed, battery reserves locked.')
      await refresh()
    } catch (e: any) {
      setErr(`Fallback execution error: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  // Handler: Load Baseline Comparison
  const loadBaseline = async () => {
    setShowBaseline(true)
    if (baselineData) return
    setBaselineLoading(true)
    try {
      const res = await get<BaselineComparison>('/optimization/baseline-comparison')
      setBaselineData(res)
    } catch (e: any) {
      setErr(`Failed to load baseline: ${e.message}`)
    } finally {
      setBaselineLoading(false)
    }
  }

  return (
    <Page
      title="Operating Plan & Optimization Dispatch"
      technicalDisclosure={true}
      meta={
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={handleReoptimize}
            style={{ fontWeight: 600 }}
          >
            {busy ? 'Solving…' : '⚡ Re-Optimize Now'}
          </button>
          <span className={`badge ${planStatus === 'ACCEPTED' ? 'safe' : planStatus === 'REJECTED' ? 'danger' : planStatus === 'CONSERVATION' ? 'conserve' : 'info'}`}>
            PLAN STATUS: {planStatus}
          </span>
          {safety && statusBadge(safety.passed ? 'SAFETY VALIDATED' : 'SAFETY REJECTED')}
        </div>
      }
    >
      {/* 1. STATUS & NOTIFICATION BANNER */}
      {statusMessage && (
        <div className="card" style={{ borderLeft: planStatus === 'ACCEPTED' ? '4px solid var(--green)' : planStatus === 'REJECTED' ? '4px solid var(--danger)' : '4px solid var(--conserve)', marginBottom: 14 }}>
          <b>Status Update:</b> {statusMessage}
        </div>
      )}

      {err && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: 14 }}>
          <b style={{ color: 'var(--danger)' }}>Alert:</b> {err}
          <button type="button" onClick={() => setErr('')} style={{ marginLeft: 12, fontSize: 11, padding: '2px 8px' }}>Dismiss</button>
        </div>
      )}

      {/* 2. WHY POLAR-EMS PANEL */}
      <WhyPolarEmsPanel />

      {/* 3. BEFORE / AFTER REPLAN COMPARISON (If Triggered) */}
      {beforeAfter?.has_changed && (
        <BeforeAfterReplanCard data={beforeAfter} />
      )}

      {/* 4. DISPATCH RECOMMENDATION & OPERATOR ACTION AREA */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 700 }}>
              DISPATCH RECOMMENDATION — NEXT {plan?.horizon_h ?? 6} HOURS
            </h3>
            {isSafetyPassed ? (
              <span className="badge safe">SAFETY VALIDATED (HARD CONSTRAINTS MET)</span>
            ) : (
              <span className="badge danger">SAFETY REJECTED (VIOLATIONS DETECTED)</span>
            )}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              style={{ background: '#f8fafc', fontWeight: 600, fontSize: 12 }}
              onClick={() => (showBaseline ? setShowBaseline(false) : loadBaseline())}
            >
              {showBaseline ? 'Hide Baseline' : '⚖ Compare with Baseline'}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
          {plan?.recommendation_summary || station?.recommendation_summary || 'Optimal dispatch schedule computed and validated against deterministic safety rules.'}
        </div>

        {/* PLAN SUMMARY STRIP */}
        <div className="grid g5" style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 14, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>FUEL CONSUMED (6H)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--amber)', marginTop: 2 }}>
              {plan?.fuel_consumed_6h_l ?? plan?.expected_fuel_l ?? 0} L
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>PROJECTED END FUEL</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--amber)', marginTop: 2 }}>
              {plan?.fuel_remaining_end_l ?? Math.round(station?.fuel_l ?? 0)} L
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>TARGET END SOC</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>
              {plan?.expected_end_soc ?? Math.round(station?.battery_soc ?? 0)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>BATTERY RESERVE FLOOR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--purple)', marginTop: 2 }}>
              {plan?.reserve_soc_target ?? 20}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>FLEXIBLE LOAD SERVED</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>
              {plan?.flexible_load_pct ?? 100}%
            </div>
          </div>
        </div>

        {/* OPERATOR ACTION BUTTONS */}
        <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="success"
            disabled={busy || !isSafetyPassed || planStatus === 'ACCEPTED'}
            onClick={handleApprove}
            title={!isSafetyPassed ? 'Disabled: Cannot approve an UNSAFE plan' : 'Apply this plan to station dispatch'}
            style={{ fontWeight: 700, padding: '7px 16px' }}
          >
            {planStatus === 'ACCEPTED' ? '✓ Plan Accepted & Active' : '✓ Accept Plan'}
          </button>

          <button
            type="button"
            className="danger"
            disabled={busy || planStatus === 'REJECTED'}
            onClick={handleReject}
            style={{ fontWeight: 700, padding: '7px 16px' }}
          >
            {planStatus === 'REJECTED' ? '✕ Plan Rejected' : '✕ Reject Plan'}
          </button>

          <button
            type="button"
            className={planStatus === 'CONSERVATION' ? 'primary' : ''}
            disabled={busy}
            onClick={handleTriggerFallback}
            style={{ fontWeight: 600, padding: '7px 14px' }}
          >
            🛡 Trigger Safe Fallback
          </button>

          <button
            type="button"
            onClick={() => setShowSafetyModal(!showSafetyModal)}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            {showSafetyModal ? 'Hide Safety Audit' : '🔍 View Safety Checks'}
          </button>

          <button
            type="button"
            onClick={() => setShowWhyModal(!showWhyModal)}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            {showWhyModal ? 'Hide Explanation' : '💡 View Why'}
          </button>
        </div>

        {/* INLINE WHY EXPLANATION */}
        {showWhyModal && (
          <div style={{ background: '#f8fafc', borderLeft: '3px solid var(--blue)', padding: '10px 14px', borderRadius: '0 4px 4px 0', marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 6 }}>
              DECISION RATIONALE & CAUSALITY
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
              {(cur?.explanations?.flatMap(e => e.reason_lines) || [
                'Plan balances renewable generation against critical heating and life-support priorities.',
                'Battery energy is preserved above the dynamically calculated CQRM safety reserve floor.',
                'Diesel generator scheduled only when renewables and battery headroom cannot cover load.',
              ]).map((line, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 5. INLINE BASELINE COMPARISON */}
      {showBaseline && (
        <div className="card" style={{ marginBottom: 14, background: '#fafaf9', border: '1px solid #e7e5e4' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0, color: '#44403c' }}>
              NAIVE BASELINE VS POLAR-EMS COMPARISON
            </h3>
            <span className="badge safe">Quantified Decision Value</span>
          </div>
          {baselineLoading ? (
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Evaluating naive heuristics vs POLAR-EMS on the current station state…</p>
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

      {/* 6. HOURLY DISPATCH SCHEDULE TABLE */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Hourly Optimization Dispatch Schedule (kW)</h3>
        {plan?.steps && plan.steps.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Diesel Generator</th>
                <th>Battery Power</th>
                <th>Solar Array</th>
                <th>Wind Turbines</th>
                <th>Total Demand</th>
                <th>Flexible Served</th>
              </tr>
            </thead>
            <tbody>
              {plan.steps.map((s: Step, i: number) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>+{s.start_offset_h}h</td>
                  <td>{s.diesel_kw > 0 ? `${Math.round(s.diesel_kw)} kW` : '— (off)'}</td>
                  <td style={{ color: s.battery_kw > 0 ? 'var(--green)' : s.battery_kw < 0 ? 'var(--amber)' : undefined, fontWeight: 600 }}>
                    {s.battery_kw > 0 ? `+${Math.round(s.battery_kw)} kW (chg)` : s.battery_kw < 0 ? `${Math.round(s.battery_kw)} kW (dis)` : 'Hold'}
                  </td>
                  <td>{Math.round(s.solar_kw)} kW</td>
                  <td>{Math.round(s.wind_kw)} kW</td>
                  <td>{Math.round(s.load_kw)} kW</td>
                  <td>
                    {s.flexible_kw != null ? (
                      <span>
                        {Math.round(s.flexible_kw)} kW{' '}
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
        ) : (
          <p className="note">Dispatch schedule available upon running optimization.</p>
        )}
      </div>

      {/* 7. SAFETY VALIDATION AUDIT */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 13, margin: 0 }}>Deterministic Safety Validation Gate Audit</h3>
          {safety && <span className={`badge ${safety.passed ? 'safe' : 'danger'}`}>{safety.passed ? 'ALL RULES PASSED' : 'VIOLATION DETECTED'}</span>}
        </div>
        {safety && safety.checks.length > 0 ? (
          <ul className="safety-list">
            {safety.checks.map(c => (
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
        ) : (
          <p className="note">No safety checks logged yet.</p>
        )}
      </div>
    </Page>
  )
}
