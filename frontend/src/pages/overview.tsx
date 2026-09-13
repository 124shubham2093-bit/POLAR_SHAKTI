import React, { useState } from 'react'
import { useStore } from '../store'
import {
  Page, statusBadge, ResupplyDelaySlider, WhatChangedCard,
  BeforeAfterReplanCard, DemoControlStrip
} from '../components'
import { post } from '../api'

interface OverviewPageProps {
  onNavigate?: (page: string) => void
}

/**
 * Overview — Operational Command Center (Judge-First).
 * Strict hierarchy enforced:
 * Above the fold:
 * 1. Demo Control Strip (when active) or [ START DEMO ] on header
 * 2. Hero Card: SAFE OPERABILITY | RESUPPLY ETA | CQRM MARGIN | STATUS BADGE
 * 3. Recommended Action Card: Plain language action + WHY? + [ VIEW OPERATING PLAN ]
 * 4. WHAT CHANGED? Card: Cause → effect relationship
 * 5. Interactive Resupply Delay Slider (0 to +7 days)
 * 6. Before / After Replan (when replan triggered)
 * 7. Compact State Strip: Fuel | Battery | Load | Renewable | Temperature | Generator
 */
export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const { station, recommendation, alerts, action, refresh } = useStore()
  const [sliderBusy, setSliderBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)

  if (!station) {
    return (
      <Page title="Station Operations">
        <p style={{ padding: 20 }}>Loading authoritative station state…</p>
      </Page>
    )
  }

  const a = station.autonomy
  const bal = station.balance
  const rec = recommendation || station.recommendation
  const margin = a?.cqrm_margin_days ?? a?.autonomy_margin_days ?? 0
  const delayDays = station.resupply?.delay_days ?? station.resupply?.model?.slider_delay_days ?? 0
  const demoState = station.demo_state

  // Locked status color classification
  const heroClass = !a ? 'safe' :
    a.status === 'SAFE' ? 'safe' :
    a.status === 'CAUTION' ? 'caution' :
    a.status === 'CONSERVE' ? 'conserve' : 'critical'

  // Slider change handler with real causality
  const handleSliderChange = async (days: number) => {
    setSliderBusy(true)
    try {
      await action('/resupply/delay', { delay_days: days })
      localStorage.setItem('polar_ems_resupply_delay', String(days))
    } finally {
      setSliderBusy(false)
    }
  }

  // Demo step controls
  const handleDemoStart = async () => {
    setDemoBusy(true)
    try {
      await post('/scenarios/demo/start', {})
      await refresh()
    } finally {
      setDemoBusy(false)
    }
  }

  const handleDemoNext = async () => {
    setDemoBusy(true)
    try {
      await post('/scenarios/demo/next', {})
      await refresh()
    } finally {
      setDemoBusy(false)
    }
  }

  const handleDemoPrev = async () => {
    setDemoBusy(true)
    try {
      await post('/scenarios/demo/prev', {})
      await refresh()
    } finally {
      setDemoBusy(false)
    }
  }

  const handleDemoPause = async () => {
    setDemoBusy(true)
    try {
      await post('/scenarios/demo/pause', {})
      await refresh()
    } finally {
      setDemoBusy(false)
    }
  }

  const handleDemoStop = async () => {
    setDemoBusy(true)
    try {
      await post('/scenarios/demo/stop', {})
      await refresh()
    } finally {
      setDemoBusy(false)
    }
  }

  const whatChanged = station.what_changed || rec?.what_changed || []
  const beforeAfter = station.before_after_replan || rec?.before_after_replan

  // Derive "WHY?" explanation
  const whyReasons = rec?.explanations?.flatMap(e => e.reason_lines) || [
    'Seasonal wind and solar conditions in equilibrium.',
    'Battery storage above mandatory reserve floor.',
  ]

  return (
    <Page
      title="POLAR-EMS — Station Command Center"
      meta={
        <div className="row" style={{ gap: 8 }}>
          {!demoState?.active ? (
            <button
              type="button"
              className="primary"
              id="btn-start-demo"
              onClick={handleDemoStart}
              disabled={demoBusy}
              style={{ fontWeight: 700, padding: '5px 14px' }}
            >
              ▶ START DEMO
            </button>
          ) : null}
          <span className="demo-track">sim hour {station.sim_time_h.toFixed(1)}</span>
        </div>
      }
    >
      {/* 1. UNOBTRUSIVE FLOATING DEMO CONTROL STRIP */}
      {demoState?.active && (
        <DemoControlStrip
          demoState={demoState}
          onNext={handleDemoNext}
          onPrev={handleDemoPrev}
          onPause={handleDemoPause}
          onStop={handleDemoStop}
        />
      )}

      {/* 2. HERO CARD — PRIMARY: Status + Safe Operability + Margin/Risk. SECONDARY: ETA + Shortfall % */}
      <div className={`hero-autonomy ${heroClass}`} id="hero-status-card">
        {/* PRIMARY — Visually dominant decision metrics */}
        <div>
          <div className="hero-label">SAFE OPERABILITY</div>
          <div className="hero-value">{a?.safe_autonomy_days ? a.safe_autonomy_days.toFixed(1) : '—'}</div>
          <div className="hero-unit">DAYS</div>
        </div>
        <div className="hero-meta">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* STATUS — Most important, visually first */}
            <span>{statusBadge(a?.status ?? 'SAFE')}</span>
            {/* RESUPPLY MARGIN — Core decision quantity */}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800,
              color: margin >= 2 ? 'var(--green)' : margin >= 0 ? 'var(--amber)' : 'var(--red)' }}>
              {margin >= 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1)}d margin
            </span>
          </div>
          {/* SECONDARY — Smaller supporting context */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span>
              Resupply ETA: <b>{a?.next_resupply_days ? `${a.next_resupply_days.toFixed(1)} d` : '—'}</b>
            </span>
            <span>
              Shortfall Risk: <b>{a?.failure_probability_before_resupply ? `${Math.round(a.failure_probability_before_resupply * 100)}%` : '—'}</b>
            </span>
          </div>
        </div>
      </div>

      {/* 3. RECOMMENDED ACTION & WHY */}
      <div className={`section rec-card ${rec?.safety?.passed ? '' : 'rejected'}`} id="recommendation-card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 700 }}>
              RECOMMENDED ACTION
            </h3>
            {rec?.safety?.passed ? (
              <span className="badge safe">SAFETY VALIDATED</span>
            ) : (
              <span className="badge critical">SAFETY REJECTED → FALLBACK</span>
            )}
          </div>
          {onNavigate && (
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('optimization')}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              VIEW OPERATING PLAN ▶
            </button>
          )}
        </div>

        <div className="rec-summary" style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
          {rec?.plan?.recommendation_summary || station.recommendation_summary || 'Calculating optimal safe dispatch…'}
        </div>

        {/* WHY? Section */}
        <div style={{ background: '#f8fafc', borderLeft: '3px solid var(--blue)', padding: '8px 12px', borderRadius: '0 4px 4px 0', marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>
            WHY?
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {whyReasons.slice(0, 3).map((r, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. WHAT CHANGED? Cause -> Effect */}
      {whatChanged.length > 0 && <WhatChangedCard changes={whatChanged} />}

      {/* 5. INTERACTIVE RESUPPLY DELAY SLIDER */}
      <div className="section">
        <ResupplyDelaySlider
          delayDays={delayDays}
          onChange={handleSliderChange}
          disabled={sliderBusy}
        />
      </div>

      {/* 6. BEFORE / AFTER REPLAN COMPARISON (When Replan Occurs) */}
      {beforeAfter?.has_changed && (
        <BeforeAfterReplanCard data={beforeAfter} />
      )}

      {/* 7. COMPACT STATE STRIP */}
      <div className="section state-strip" id="live-state-strip">
        <div className="state-item">
          <span className="state-label">Fuel</span>
          <span className="state-value">{Math.round(station.fuel_l).toLocaleString()} L</span>
          <span className="state-label">({Math.round(station.fuel_pct)}%)</span>
        </div>
        <div className="state-item">
          <span className="state-label">Battery</span>
          <span className="state-value">{Math.round(station.battery_soc)}% SOC</span>
          <span className="state-label">({station.battery_power_kw >= 0 ? `+${station.battery_power_kw.toFixed(0)}` : station.battery_power_kw.toFixed(0)} kW)</span>
        </div>
        <div className="state-item">
          <span className="state-label">Load</span>
          <span className="state-value">{Math.round(station.loads.total_kw)} kW</span>
          <span className="state-label">({Math.round(station.loads.critical_kw)} crit)</span>
        </div>
        <div className="state-item">
          <span className="state-label">Renewables</span>
          <span className="state-value">{Math.round(bal.solar_kw + bal.wind_kw)} kW</span>
          <span className="state-label">({Math.round(bal.solar_kw)}s / {Math.round(bal.wind_kw)}w)</span>
        </div>
        <div className="state-item">
          <span className="state-label">Temperature</span>
          <span className="state-value">{station.weather.temperature_c.toFixed(1)}°C</span>
          <span className="state-label">({station.weather.wind_speed_ms.toFixed(0)} m/s)</span>
        </div>
        <div className="state-item">
          <span className="state-label">Generator</span>
          <span className="state-value">
            {station.generator_failed ? 'FAILED' : station.generator_running ? `${Math.round(station.generator_output_kw)} kW` : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* 8. PROGRESSIVE DISCLOSURE — TECHNICAL ARCHITECTURE DETAILS (Behind Accordion) */}
      <details className="section" style={{ marginTop: 16 }}>
        <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
          ▸ Technical Architecture & Methodology Details (Inspect Mathematical Chain)
        </summary>
        <div className="card" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <p>
            <b>Pipeline Flow:</b> Current Station State → Forecast + Weather Uncertainty + Resupply ETA Model →
            Uncertainty Scenarios → Safe-Operability Engine → CQRM Margin → Resupply-Conditioned LP Optimizer →
            Safety Validator → Recommendation & Operator Action.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
            <div>
              <b>Safe Operability Horizon:</b>
              <div>Conservative (P90): {a?.conservative_days?.toFixed(1) ?? '—'} d</div>
              <div>Expected (Median): {a?.expected_days?.toFixed(1) ?? '—'} d</div>
              <div>Optimistic (P10): {a?.optimistic_days?.toFixed(1) ?? '—'} d</div>
            </div>
            <div>
              <b>Resupply Distribution:</b>
              <div>Scheduled: {station.resupply?.model?.scheduled_base_days ?? 6.0} d</div>
              <div>Expected ETA: {a?.next_resupply_days?.toFixed(1) ?? '—'} d</div>
              <div>Weather Penalty: +{station.resupply?.model?.weather_delay_factor_days?.toFixed(1) ?? 0} d</div>
            </div>
            <div>
              <b>Active Constraints:</b>
              <div>Battery Floor: {rec?.plan?.reserve_soc_target ?? 20}%</div>
              <div>Flexible Load Multiplier: {rec?.plan?.flexible_load_pct ?? 100}%</div>
              <div>LP Compute Time: {(rec as any)?.pipeline_ms ?? '1.2'} ms</div>
            </div>
          </div>
          <span className="sim-technical-note">
            Values shown are simulated for prototype evaluation.
          </span>
        </div>
      </details>
    </Page>
  )
}
