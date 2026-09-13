import React from 'react'
import { WhatChanged, BeforeAfterReplan, DemoState } from './api'

export const Page: React.FC<{
  title: string
  children: React.ReactNode
  meta?: React.ReactNode
  technicalDisclosure?: boolean
}> = ({ title, children, meta, technicalDisclosure = false }) => (
  <div>
    <div className="topbar">
      <h2>{title}</h2>
      <div className="meta">{meta}</div>
    </div>
    {technicalDisclosure && (
      <span className="sim-technical-note">
        Values shown are simulated for prototype evaluation.
      </span>
    )}
    {children}
  </div>
)

export const Kpi: React.FC<{
  label: string
  value: React.ReactNode
  unit?: string
  sub?: string
  hero?: boolean
}> = ({ label, value, unit, sub, hero }) => (
  <div className={`card kpi ${hero ? 'hero' : ''}`}>
    <div className="label">{label}</div>
    <div className="value">
      {value}
      {unit && <span className="unit"> {unit}</span>}
    </div>
    {sub && <div className="sub">{sub}</div>}
  </div>
)

export const Meter: React.FC<{ pct: number; ok?: number; warn?: number }> = ({ pct, ok = 50, warn = 25 }) => {
  const cls = pct >= ok ? 'ok' : pct >= warn ? 'warn' : 'crit'
  return (
    <div className={`meter ${cls}`}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

/** Lightweight inline SVG line chart (no external chart lib). */
export const LineChart: React.FC<{
  series: { data: number[]; color: string; label: string }[]
  height?: number
  yMin?: number
  yMax?: number
}> = ({ series, height = 160, yMin, yMax }) => {
  const all = series.flatMap(s => s.data).filter(v => Number.isFinite(v))
  if (!all.length) return <div className="chart-svg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b6675' }}>no data</div>
  const min = yMin ?? Math.min(...all) * 0.95
  const max = yMax ?? Math.max(...all) * 1.05
  const W = 600, H = height, pad = 18
  const n = Math.max(...series.map(s => s.data.length))
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad)
  const y = (v: number) => H - pad - ((v - min) / Math.max(1e-9, max - min)) * (H - 2 * pad)
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <line x1={pad} y1={y(0)} x2={W - pad} y2={y(0)} stroke="#edf0f3" />
      <text x={pad} y={12} fontSize="9" fill="#5b6675">{max.toFixed(0)}</text>
      <text x={pad} y={H - 4} fontSize="9" fill="#5b6675">{min.toFixed(0)}</text>
      {series.map((s, si) => (
        <polyline key={si} fill="none" stroke={s.color} strokeWidth="1.5"
          points={s.data.map((v, i) => `${x(i)},${y(Number.isFinite(v) ? v : min)}`).join(' ')} />
      ))}
    </svg>
  )
}

/**
 * Locked status semantics:
 * SAFE     → green
 * CAUTION  → amber
 * CONSERVE → orange/amber
 * CRITICAL → red
 */
export const statusBadge = (status: string) => {
  const s = (status || '').toUpperCase()
  if (['SAFE', 'NORMAL', 'APPROVED', 'ONLINE', 'CONNECTED', 'OPERATIONAL', 'OK'].some(k => s === k || s.startsWith(k))) {
    return <span className="badge safe">{status}</span>
  }
  if (['CAUTION', 'RESUPPLY RISK', 'RESUPPLY_RISK', 'WARNING'].some(k => s.includes(k))) {
    return <span className="badge caution">{status}</span>
  }
  if (['CONSERVE', 'ENERGY_CONSERVATION', 'CONSERVATION', 'THROTTLED'].some(k => s.includes(k))) {
    return <span className="badge conserve">{status}</span>
  }
  if (['CRITICAL', 'EMERGENCY', 'REJECTED', 'OFFLINE', 'FAILED', 'ERROR', 'DISCONNECTED'].some(k => s.includes(k))) {
    return <span className="badge critical">{status}</span>
  }
  return <span className="badge safe">{status}</span>
}

/** Persistent Top-Bar Synthetic Label */
export const SyntheticTopBadge: React.FC = () => (
  <div className="synthetic-top-badge" title="Prototype Evaluation Disclosure">
    <span style={{ color: '#2563eb' }}>●</span> DEMO / SYNTHETIC STATION DATA
  </div>
)

/** Unobtrusive Demo Control Strip */
export const DemoControlStrip: React.FC<{
  demoState: DemoState
  onNext: () => void
  onPrev?: () => void
  onPause: () => void
  onStop: () => void
}> = ({ demoState, onNext, onPrev, onPause, onStop }) => {
  if (!demoState || !demoState.active) return null
  return (
    <div className="demo-control-strip" id="demo-control-strip">
      <div className="demo-title">
        <span className="demo-tag">POLAR-EMS DEMO</span>
        <span className="demo-step-badge">
          Step {demoState.step} / {demoState.total_steps || 7}
        </span>
        <span className="demo-name">{demoState.name}</span>
        {demoState.badge && (
          <span className="badge info" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            {demoState.badge}
          </span>
        )}
      </div>
      <div className="demo-actions">
        {onPrev && (
          <button type="button" onClick={onPrev} title="Previous Step">
            ◀ Prev
          </button>
        )}
        <button type="button" onClick={onPause}>
          {demoState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button type="button" className="btn-next" onClick={onNext}>
          Next Step ▶
        </button>
        <button type="button" onClick={onStop} style={{ background: 'transparent', borderColor: 'transparent', color: '#94a3b8' }}>
          ✕ Exit Demo
        </button>
      </div>
    </div>
  )
}

/** Interactive Resupply Delay Slider (0 to +7 days, step 1) */
export const ResupplyDelaySlider: React.FC<{
  delayDays: number
  onChange: (days: number) => void
  disabled?: boolean
}> = ({ delayDays, onChange, disabled }) => {
  const [val, setVal] = React.useState(delayDays)

  React.useEffect(() => {
    setVal(delayDays)
  }, [delayDays])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value)
    setVal(next)
    onChange(next)
  }

  return (
    <div className="resupply-slider-card">
      <div className="resupply-slider-header">
        <h4>RESUPPLY DELAY</h4>
        <div className="current-delay">
          Current: <b>+{val.toFixed(0)} days</b>
        </div>
      </div>
      <div className="slider-track-wrap">
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>0d</span>
        <input
          id="resupply-delay-slider"
          type="range"
          min="0"
          max="7"
          step="1"
          value={val}
          onChange={handleChange}
          disabled={disabled}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>+7d</span>
      </div>
      <div className="slider-labels">
        <span>0 days</span>
        <span>+1</span>
        <span>+2</span>
        <span>+3</span>
        <span>+4</span>
        <span>+5</span>
        <span>+6</span>
        <span>+7 days</span>
      </div>
      <div className="slider-impact-note">
        <b>Causality:</b> Moving this slider updates the probabilistic arrival model and directly re-optimizes
        battery reserves and flexible load throttling across the station.
      </div>
    </div>
  )
}

/** "WHAT CHANGED?" Cause -> Effect Component */
export const WhatChangedCard: React.FC<{
  changes: WhatChanged[]
}> = ({ changes }) => {
  if (!changes || !changes.length) return null
  return (
    <div className="what-changed-card" id="what-changed-section">
      <div className="what-changed-header">
        <h4>WHAT CHANGED?</h4>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Live System Diffs</span>
      </div>
      <div className="what-changed-list">
        {changes.map((c, i) => (
          <div key={i} className="what-changed-item">
            <span className={`arrow ${c.direction}`}>
              {c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '→'}
            </span>
            <div className="text">
              <div className="metric-name">{c.metric}</div>
              <div className="metric-detail">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="what-changed-footer">
        These changes caused the operating plan to be dynamically updated.
      </div>
    </div>
  )
}

/** BEFORE / AFTER REPLAN Comparison Component with TRIGGER → PLAN CHANGE → RESULT */
export const BeforeAfterReplanCard: React.FC<{
  data?: BeforeAfterReplan
}> = ({ data }) => {
  if (!data) return null
  const { before, after, reason, trigger_description, result } = data
  return (
    <div className="before-after-card" id="before-after-replan-section">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
          OPTIMIZER DECISION: BEFORE VS AFTER REPLAN
        </h3>
        <span className="badge info">Causality Verified</span>
      </div>

      {/* TRIGGER — What caused the replan */}
      {trigger_description && trigger_description !== 'Nominal conditions' && (
        <div style={{ background: '#fef3c7', borderLeft: '3px solid var(--amber)', padding: '6px 12px',
          borderRadius: '0 4px 4px 0', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
          <b>TRIGGER:</b> {trigger_description}
        </div>
      )}

      <div className="before-after-grid">
        <div className="before-box">
          <h5>BEFORE REPLAN (NOMINAL)</h5>
          <div className="diff-metrics">
            <div className="diff-metric">
              <div className="label">Battery Dispatch</div>
              <div className="val">{before.battery_kw.toFixed(0)} kW</div>
            </div>
            <div className="diff-metric">
              <div className="label">Diesel Gen</div>
              <div className="val">{before.diesel_kw.toFixed(0)} kW</div>
            </div>
            <div className="diff-metric">
              <div className="label">Flexible Load</div>
              <div className="val">{before.flexible_load_pct.toFixed(0)}%</div>
            </div>
            <div className="diff-metric">
              <div className="label">Reserve Floor</div>
              <div className="val">{before.reserve_soc_pct.toFixed(0)}%</div>
            </div>
          </div>
        </div>
        <div className="after-box">
          <h5>AFTER REPLAN (RISK-CONDITIONED)</h5>
          <div className="diff-metrics">
            <div className="diff-metric">
              <div className="label">Battery Dispatch</div>
              <div className="val">{after.battery_kw.toFixed(0)} kW</div>
            </div>
            <div className="diff-metric">
              <div className="label">Diesel Gen</div>
              <div className="val">{after.diesel_kw.toFixed(0)} kW</div>
            </div>
            <div className="diff-metric">
              <div className="label">Flexible Load</div>
              <div className="val" style={{ color: after.flexible_load_pct < 100 ? 'var(--conserve)' : 'inherit' }}>
                {after.flexible_load_pct.toFixed(0)}%
              </div>
            </div>
            <div className="diff-metric">
              <div className="label">Reserve Floor</div>
              <div className="val" style={{ color: after.reserve_soc_pct > 20 ? 'var(--blue)' : 'inherit' }}>
                {after.reserve_soc_pct.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULT — Outcome of the replan */}
      {result && (
        <div style={{ background: '#f0fdf4', borderLeft: '3px solid var(--green)', padding: '6px 12px',
          borderRadius: '0 4px 4px 0', marginTop: 10, fontSize: 12, color: '#166534' }}>
          <b>RESULT:</b> {result}
        </div>
      )}

      {reason && !result && (
        <div className="replan-reason">
          <b>Reason:</b> {reason}
        </div>
      )}
    </div>
  )
}

/** "WHY NOT JUST USE A NORMAL EMS?" Innovation Panel */
export const WhyPolarEmsPanel: React.FC = () => (
  <div className="why-polar-panel">
    <h3>WHY POLAR-EMS?</h3>
    <div className="why-polar-comparison">
      <div className="why-col">
        <h6>Traditional EMS</h6>
        <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', marginBottom: 6 }}>
          Forecast → Optimize → Dispatch
        </div>
        <p>
          Assumes continuous fuel supply and treats battery reserves as fixed constants. Fails to adjust
          dispatch when weather halts supply ships or blizzards ground logistics.
        </p>
      </div>
      <div className="why-col" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
        <h6 style={{ color: 'var(--blue)' }}>POLAR-EMS</h6>
        <div style={{ fontFamily: 'var(--mono)', color: 'var(--blue)', fontWeight: 600, marginBottom: 6 }}>
          Forecast + Weather Uncertainty + Resupply Uncertainty → Risk-Aware Dispatch → Safety Gate
        </div>
        <p>
          Continuously evaluates cumulative survival margins (CQRM) against weather-gated logistics windows.
          The resupply probability distribution directly constrains optimization and triggers timely conservation.
        </p>
      </div>
    </div>
    <div className="why-key-takeaway">
      The resupply uncertainty is not just displayed; it actively changes the operating decision.
    </div>
  </div>
)

export const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
