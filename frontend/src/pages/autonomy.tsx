import React, { useState } from 'react'
import { useStore } from '../store'
import { Page, statusBadge, ResupplyDelaySlider } from '../components'
import { post, runScenarioV1, ScenarioV1Response } from '../api'

export const AutonomyPage: React.FC = () => {
  const { station, action, refresh } = useStore()
  const [busy, setBusy] = useState(false)
  const [showViolations, setShowViolations] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [scenarioModal, setScenarioModal] = useState(false)
  const [customScenarioResult, setCustomScenarioResult] = useState<ScenarioV1Response | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  if (!station) return <Page title="Safe Operability & CQRM"><p>Loading station state…</p></Page>
  const a = station.autonomy
  if (!a) return <Page title="Safe Operability & CQRM"><p>Autonomy engine calculating…</p></Page>

  const margin = customScenarioResult ? customScenarioResult.cqrm_days : (a.cqrm_margin_days ?? a.autonomy_margin_days ?? 0)
  const safeDays = customScenarioResult ? customScenarioResult.safe_operability_days : a.safe_autonomy_days
  const p90Days = customScenarioResult ? customScenarioResult.resupply_p90_days : (a.resupply_conservative_days ?? station.resupply.in_days * 1.3)
  const currentRisk = customScenarioResult ? customScenarioResult.risk_level : a.status
  const reserveSoc = customScenarioResult ? customScenarioResult.required_reserve_soc_pct : (station.recommendation?.plan?.reserve_soc_target ?? 55)

  const heroClass =
    currentRisk === 'SAFE' ? 'safe' :
    currentRisk === 'CAUTION' ? 'caution' :
    currentRisk === 'CONSERVE' ? 'conserve' : 'critical'

  const delayDays = station?.resupply?.delay_days ?? station?.resupply?.model?.slider_delay_days ?? 0

  const handleRunAnalysis = async () => {
    setBusy(true)
    setStatusMsg('')
    try {
      const activeSc = localStorage.getItem('polar_ems_active_scenario') || 'NORMAL'
      const res = await runScenarioV1(activeSc, delayDays)
      setCustomScenarioResult(res)
      setStatusMsg(`Safe Operability & CQRM analysis updated at ${new Date().toLocaleTimeString()}.`)
      await refresh()
    } catch (e: any) {
      setStatusMsg(`Analysis error: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      title="Safe Operability & CQRM Assessment"
      technicalDisclosure={true}
      meta={
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={handleRunAnalysis}
            style={{ fontWeight: 600 }}
          >
            {busy ? 'Simulating…' : '▶ Run Analysis'}
          </button>
          {statusBadge(currentRisk)}
        </div>
      }
    >
      {/* 1. STATUS NOTIFICATION */}
      {statusMsg && (
        <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 12 }}>
          <b>Status:</b> {statusMsg}
        </div>
      )}

      {/* 2. QUESTION-ORIENTED CORE ANSWER */}
      <div className="card" style={{ borderLeft: margin < 0 ? '4px solid var(--danger)' : '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: margin < 0 ? 'var(--danger)' : 'var(--blue)', fontWeight: 700 }}>
          CAN THE STATION SAFELY OPERATE LONG ENOUGH TO REACH RESUPPLY?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          {margin >= 0
            ? `YES (WITH MARGIN): Current safe operability of ${safeDays.toFixed(2)} days exceeds the conservative P90 resupply estimate (${p90Days.toFixed(2)} days) by +${margin.toFixed(2)} days.`
            : `DEFICIT DETECTED: The station safe-operability horizon (${safeDays.toFixed(2)} days) is shorter than the conservative P90 resupply estimate (${p90Days.toFixed(2)} days) by ${Math.abs(margin).toFixed(2)} days.`}
        </p>
      </div>

      {/* 3. HERO CQRM CARD */}
      <div className={`hero-autonomy ${heroClass}`} style={{ marginBottom: 16 }}>
        <div>
          <div className="hero-label">SAFE OPERABILITY HORIZON</div>
          <div className="hero-value">{safeDays ? safeDays.toFixed(2) : '—'}</div>
          <div className="hero-unit">DAYS SAFE</div>
        </div>
        <div className="hero-meta">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{statusBadge(currentRisk)}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800,
              color: margin >= 2 ? 'var(--green)' : margin >= 0 ? 'var(--amber)' : 'var(--red)' }}>
              {margin >= 0 ? `+${margin.toFixed(2)}` : margin.toFixed(2)}d CQRM Margin
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span>Conservative P90 Resupply: <b>{p90Days.toFixed(2)} days</b></span>
            <span>Required Reserve SOC: <b>{reserveSoc.toFixed(1)}%</b></span>
            <span>Current Battery SOC: <b>{Math.round(station.battery_soc)}%</b></span>
          </div>
        </div>
      </div>

      {/* 4. THE DECISION CHAIN EXPLAINER */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', margin: '0 0 10px' }}>
          CQRM DECISION CHAIN (MATHEMATICAL ARCHITECTURE)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center', fontSize: 12 }}>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>1. SAFE OPERABILITY</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)', marginTop: 4 }}>{safeDays.toFixed(2)} d</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>2. P90 RESUPPLY</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', marginTop: 4 }}>{p90Days.toFixed(2)} d</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>3. CQRM MARGIN</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: margin >= 0 ? 'var(--green)' : 'var(--danger)', marginTop: 4 }}>
              {margin >= 0 ? `+${margin.toFixed(2)}` : margin.toFixed(2)} d
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>4. RISK LEVEL</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: margin >= 0 ? 'var(--green)' : 'var(--danger)', marginTop: 4 }}>{currentRisk}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>5. RESERVE FLOOR</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)', marginTop: 4 }}>{reserveSoc.toFixed(1)}% SOC</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>6. RECOMMENDATION</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 4 }}>{margin >= 0 ? 'ACCEPT' : 'CONSERVE'}</div>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE BUTTON CONTROLS */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', margin: '0 0 10px' }}>
          INTERACTIVE CQRM AUDIT & ACTIONS
        </h4>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="primary"
            onClick={handleRunAnalysis}
            disabled={busy}
          >
            {busy ? 'Running…' : '🔄 Refresh Forward Simulation'}
          </button>
          <button
            type="button"
            onClick={() => setShowPolicyModal(!showPolicyModal)}
          >
            {showPolicyModal ? 'Hide Reserve Policy' : '📊 View Reserve Policy Formula'}
          </button>
          <button
            type="button"
            onClick={() => setShowViolations(!showViolations)}
          >
            {showViolations ? 'Hide Violations' : '⚠️ Inspect Safety Constraints'}
          </button>
          <button
            type="button"
            onClick={() => setScenarioModal(!scenarioModal)}
          >
            {scenarioModal ? 'Hide Scenario Comparison' : '⚡ Compare With Stress Scenario'}
          </button>
        </div>

        {/* INLINE RESERVE POLICY MODAL/PANEL */}
        {showPolicyModal && (
          <div style={{ background: '#f8fafc', borderLeft: '3px solid var(--purple)', padding: 12, borderRadius: 4, marginTop: 12, fontSize: 12 }}>
            <b style={{ color: 'var(--purple)' }}>Dynamic Reserve Policy Methodology:</b>
            <p style={{ margin: '4px 0 6px', color: '#334155' }}>
              Reserve policy scales the required battery floor according to CQRM severity:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#475569' }}>
              <li><b>SAFE (CQRM &gt; 2.0 d):</b> Base reserve floor = 45% SOC</li>
              <li><b>CAUTION (0.0 &lt; CQRM &le; 2.0 d):</b> Base reserve floor = 55% SOC</li>
              <li><b>CONSERVE (-2.0 &lt; CQRM &le; 0.0 d):</b> Base reserve floor = 65% SOC + margin penalty</li>
              <li><b>CRITICAL (CQRM &le; -2.0 d):</b> Base reserve floor = 75% SOC + min(10%, |CQRM| &times; 0.5)</li>
            </ul>
          </div>
        )}

        {/* INLINE VIOLATIONS PANEL */}
        {showViolations && (
          <div style={{ background: '#fef2f2', borderLeft: '3px solid var(--danger)', padding: 12, borderRadius: 4, marginTop: 12, fontSize: 12 }}>
            <b style={{ color: 'var(--danger)' }}>Safety & Operability Constraint Checklist:</b>
            <div style={{ marginTop: 6, color: '#334155' }}>
              <div>• Minimum Battery SOC Floor: &ge; 20.0% (Enforced at every forward timestep)</div>
              <div>• Minimum Battery SOH: &ge; 70.0%</div>
              <div>• Fuel Reserve Floor: &ge; 800 L (Generator shutdown threshold)</div>
              <div>• Minimum Generator Availability: &ge; 250 kW</div>
              <div>• Critical Load Service: 100% Guaranteed Uninterrupted</div>
            </div>
          </div>
        )}

        {/* INLINE SCENARIO COMPARISON PANEL */}
        {scenarioModal && (
          <div style={{ background: '#f8fafc', borderLeft: '3px solid var(--blue)', padding: 12, borderRadius: 4, marginTop: 12, fontSize: 12 }}>
            <b>Quick Stress Scenario Evaluation:</b>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button onClick={() => { localStorage.setItem('polar_ems_active_scenario', 'NORMAL'); handleRunAnalysis(); }}>NORMAL (+0.49d)</button>
              <button onClick={() => { localStorage.setItem('polar_ems_active_scenario', 'RESUPPLY_DELAY_4D'); handleRunAnalysis(); }}>+4D DELAY (-3.51d)</button>
              <button onClick={() => { localStorage.setItem('polar_ems_active_scenario', 'STORM'); handleRunAnalysis(); }}>STORM (-4.72d)</button>
              <button onClick={() => { localStorage.setItem('polar_ems_active_scenario', 'LOW_RENEWABLE'); handleRunAnalysis(); }}>LOW RENEWABLE (-4.18d)</button>
            </div>
          </div>
        )}
      </div>

      {/* 6. INTERACTIVE RESUPPLY DELAY SLIDER */}
      <div className="section">
        <ResupplyDelaySlider
          delayDays={delayDays}
          onChange={(d) => action('/resupply/delay', { delay_days: d })}
        />
      </div>
    </Page>
  )
}
