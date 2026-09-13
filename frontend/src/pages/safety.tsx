import React, { useEffect, useState } from 'react'
import { get, post } from '../api'
import { Page, statusBadge, Kpi } from '../components'
import { useStore } from '../store'

export const SafetyPage: React.FC = () => {
  const { station, refresh } = useStore()
  const [rules, setRules] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { get<{ rules: Record<string, number> }>('/actions/rules').then(r => setRules(r.rules)) }, [])

  const setRule = (k: string, v: string) => setRules(r => ({ ...r, [k]: parseFloat(v) || 0 }))

  const save = async () => {
    await post('/actions', { action: 'set_thresholds', params: rules })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    await refresh()
  }

  const sv = station?.safety

  return (
    <Page title="Safety & Critical Loads" meta={sv && statusBadge(sv.passed ? 'VALIDATED' : 'VIOLATION')}>
      {/* QUESTION-ORIENTED SUMMARY */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--blue)' }}>
          IS THE PROPOSED PLAN SAFE?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          Every optimizer plan must pass deterministic safety validation before it can be applied.
          The operator always has the final authority to approve, reject, or override any recommendation.
        </p>
      </div>

      {/* AUTHORITY HIERARCHY — Correction #9 */}
      <div className="card" style={{ marginBottom: 14, background: '#f8fafc', border: '1px solid var(--border)' }}>
        <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          DECISION AUTHORITY HIERARCHY
        </h4>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 2, color: '#334155' }}>
          Forecast & Uncertainty → <b>Optimizer proposes plan</b> →{' '}
          <b style={{ color: 'var(--blue)' }}>Deterministic Safety Gate</b> →{' '}
          <span style={{ color: sv?.passed ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            {sv?.passed ? 'PASS → Operator approval' : 'FAIL → Safe fallback'}
          </span>{' '}
          → <span style={{ color: 'var(--text-dim)' }}>Hardware protection remains independent</span>
        </div>
        <div className="note" style={{ marginTop: 6 }}>
          The AI optimizer never directly controls the station. Every plan is filtered through 6 deterministic safety rules
          before reaching the operator for approval.
        </div>
      </div>
      <div className="grid g4">
        <Kpi label="Critical Load" value={station?.loads.critical_kw ?? '—'} unit="kW" sub="never shed automatically" />
        <Kpi label="Essential Load" value={Math.round(station?.loads.essential_kw ?? 0)} unit="kW" sub="reduced only when required" />
        <Kpi label="Flexible Load" value={Math.round(station?.loads.flexible_kw ?? 0)} unit="kW" sub={`shed ${Math.round((station?.loads.flexible_shed_pct ?? 0) * 100)}%`} />
        <Kpi label="Emergency SOC" value={rules.emergency_battery_soc ?? '—'} unit="%" sub="triggers EMERGENCY mode" />
      </div>

      <div className="section grid g2">
        <div className="card">
          <h3>Safety Validation</h3>
          {sv && sv.checks.length > 0 ? (
            <ul className="safety-list">
              {sv.checks.map(c => (
                <li key={c.rule}>
                  <span className={`check ${c.passed ? 'pass' : 'fail'}`}>{c.passed ? '✓' : '✗'}</span>
                  <span style={{ flex: 1 }}>{c.rule.replace(/_/g, ' ')}</span>
                  <span className="note" style={{ margin: 0 }}>{c.detail}</span>
                </li>
              ))}
            </ul>
          ) : <p className="note">No validation run yet — run optimization first.</p>}
          <h3 style={{ marginTop: 12 }}>Load Priority</h3>
          <ul style={{ fontSize: 12, marginLeft: 16 }}>
            <li><b>CRITICAL</b> — heating, communications, life-support, essential science (72 kW). Never shed.</li>
            <li><b>ESSENTIAL</b> — reduced only when required.</li>
            <li><b>FLEXIBLE</b> — delayed/rescheduled by the optimizer (water heating, non-critical experiments, maintenance).</li>
          </ul>
        </div>
        <div className="card">
          <h3>Configurable Safety Rules</h3>
          <table>
            <tbody>
              {Object.entries(rules).map(([k, v]) => (
                <tr key={k}>
                  <td className="plain">{k.replace(/_/g, ' ')}</td>
                  <td>
                    <input type="number" value={v} onChange={e => setRule(k, e.target.value)} style={{ width: 90 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save Thresholds'}</button>
            <button onClick={() => post('/actions', { action: 'set_flexible_shed', params: { pct: (station?.loads.flexible_shed_pct ?? 0) > 0 ? 0 : 40 } }).then(refresh)}>
              {(station?.loads.flexible_shed_pct ?? 0) > 0 ? 'Restore Flexible Loads' : 'Shed Flexible Loads 40%'}
            </button>
          </div>
          <div className="note">If a plan violates any rule (e.g. battery SOC 22% vs minimum 30%), the optimization plan is REJECTED and a safe fallback strategy activates.</div>
        </div>
      </div>
    </Page>
  )
}
