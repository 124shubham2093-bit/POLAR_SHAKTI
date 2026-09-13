import React from 'react'
import { useStore } from '../store'
import { Page, statusBadge, ResupplyDelaySlider } from '../components'

export const AutonomyPage: React.FC = () => {
  const { station, action } = useStore()
  if (!station) return <Page title="Safe Operability & CQRM"><p>Loading station state…</p></Page>
  const a = station.autonomy
  if (!a) return <Page title="Safe Operability & CQRM"><p>Autonomy engine calculating…</p></Page>

  const margin = a.cqrm_margin_days ?? a.autonomy_margin_days ?? 0
  const heroClass =
    a.status === 'SAFE' ? 'safe' :
    a.status === 'CAUTION' ? 'caution' :
    a.status === 'CONSERVE' ? 'conserve' : 'critical'

  const delayDays = station?.resupply?.delay_days ?? station?.resupply?.model?.slider_delay_days ?? 0

  return (
    <Page
      title="Safe Operability & CQRM"
      technicalDisclosure={true}
      meta={statusBadge(a.status)}
    >
      {/* QUESTION-ORIENTED SUMMARY */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--blue)' }}>
          HOW LONG CAN CRITICAL SERVICES REMAIN SUPPORTED?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          {a.interpretation}
        </p>
      </div>

      {/* PRIMARY METRIC — Single dominant Safe Operability number */}
      <div className={`hero-autonomy ${heroClass}`}>
        <div>
          <div className="hero-label">SAFE OPERABILITY</div>
          <div className="hero-value">{a.safe_autonomy_days ? a.safe_autonomy_days.toFixed(1) : '—'}</div>
          <div className="hero-unit">DAYS</div>
        </div>
        <div className="hero-meta">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{statusBadge(a.status)}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800,
              color: margin >= 2 ? 'var(--green)' : margin >= 0 ? 'var(--amber)' : 'var(--red)' }}>
              {margin >= 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1)}d margin
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span>Resupply ETA: <b>{a.next_resupply_days ? `${a.next_resupply_days.toFixed(1)} d` : '—'}</b></span>
            <span>Shortfall Risk: <b>{a.failure_probability_before_resupply ? `${Math.round(a.failure_probability_before_resupply * 100)}%` : '—'}</b></span>
          </div>
        </div>
      </div>

      {/* SECONDARY — Scenario breakdown (not primary decision info) */}
      <div className="section" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>
          SCENARIO RANGE
        </h4>
        <div className="grid g3">
          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>CONSERVATIVE</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>
              {a.conservative_days ? a.conservative_days.toFixed(1) : a.safe_autonomy_days.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400 }}>days</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Low renewables + thermal surge</div>
          </div>
          <div className="card" style={{ padding: '10px 14px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>EXPECTED</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
              {a.expected_days ? a.expected_days.toFixed(1) : (a.safe_autonomy_days * 1.3).toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400 }}>days</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Median conditions</div>
          </div>
          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>OPTIMISTIC</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--purple)' }}>
              {a.optimistic_days ? a.optimistic_days.toFixed(1) : (a.safe_autonomy_days * 1.5).toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400 }}>days</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>High wind/solar availability</div>
          </div>
        </div>
      </div>

      {/* Interactive Slider */}
      <div className="section">
        <ResupplyDelaySlider
          delayDays={delayDays}
          onChange={(d) => action('/resupply/delay', { delay_days: d })}
        />
      </div>

      {/* TECHNICAL DETAILS — Hidden by default */}
      <details className="section">
        <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
          ▸ Technical Details (Methodology, Assumptions & Reserve Bounds)
        </summary>
        <div className="card" style={{ marginTop: 8 }}>
          <h4 style={{ fontSize: 12, marginBottom: 6 }}>Methodology</h4>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>{a.methodology}</p>
          <div style={{ marginTop: 10, background: '#f8fafc', padding: 10, borderRadius: 4, fontSize: 12, color: '#334155' }}>
            <b>Key Differentiator:</b> The system performs forward hourly dispatch integration, accounting for diurnal heating variations,
            forecast prediction intervals, usable battery energy down to reserve, and generator efficiency curves.
          </div>
          <h4 style={{ fontSize: 12, marginTop: 14, marginBottom: 6 }}>Calculation Assumptions</h4>
          <table>
            <tbody>
              {Object.entries(a.assumptions || {}).map(([k, v]) => (
                <tr key={k}>
                  <td className="plain" style={{ fontWeight: 600 }}>{k.replace(/_/g, ' ')}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Page>
  )
}
