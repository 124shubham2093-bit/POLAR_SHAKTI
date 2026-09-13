import React, { useState, useEffect } from 'react'
import { get, BaselineComparison } from '../api'
import { Page, statusBadge } from '../components'
import { useStore } from '../store'

/** Baseline vs POLAR-EMS — the measurable value demonstration.
 *  Same station, same conditions, different management strategy. */
export const BaselinePage: React.FC = () => {
  const { station } = useStore()
  const [cmp, setCmp] = useState<BaselineComparison | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    try {
      const r = await get<BaselineComparison>('/optimization/baseline-comparison')
      setCmp(r)
    } finally { setBusy(false) }
  }

  // Auto-load comparison on mount (Correction #4 — never show empty page)
  useEffect(() => { load() }, [])

  const rows = cmp ? [
    ['Diesel consumed (6h)', `${cmp.baseline.fuel_consumed_6h_l} L`, `${cmp.polar_ems.fuel_consumed_6h_l} L`, cmp.delta.fuel_saved_6h_l, 'L saved', true],
    ['Fuel remaining after plan', `${cmp.baseline.fuel_remaining_end_l} L`, `${cmp.polar_ems.fuel_remaining_end_l} L`, null, null, false],
    ['End battery SOC', `${cmp.baseline.end_soc}%`, `${cmp.polar_ems.end_soc}%`, cmp.delta.end_soc_improvement_pct, '% improvement', true],
    ['Renewable utilisation (avg)', `${cmp.baseline.renewable_utilised_kw_avg} kW`, `${cmp.polar_ems.renewable_utilised_kw_avg} kW`, cmp.delta.renewable_utilisation_improvement_kw, 'kW more', true],
    ['Diesel output (avg)', `${cmp.baseline.diesel_avg_kw} kW`, `${cmp.polar_ems.diesel_avg_kw} kW`, null, null, false],
    ['Safe autonomy', `${cmp.baseline.safe_autonomy_days} days`, `${cmp.polar_ems.safe_autonomy_days} days`, cmp.delta.autonomy_gain_days, 'days gained', true],
    ['Resupply margin', `${cmp.baseline.resupply_margin_days} days`, `${cmp.polar_ems.resupply_margin_days} days`, null, null, false],
    ['Critical load coverage', `${cmp.baseline.critical_load_hours_met}/${cmp.baseline.critical_load_hours_total} h`, `${cmp.polar_ems.critical_load_hours_met}/${cmp.polar_ems.critical_load_hours_total} h`, null, null, false],
    ['First actionable warning',
      cmp.warning_lead_time ? `${cmp.warning_lead_time.baseline_first_warning_days} days` : '—',
      cmp.warning_lead_time ? `${cmp.warning_lead_time.polar_ems_first_warning_days} days` : '—',
      cmp.warning_lead_time ? cmp.warning_lead_time.early_warning_advantage_days : null, 'days earlier', true],
    ['Safety validated', '—', cmp.polar_ems.safety_validated ? 'YES' : 'NO', null, null, false],
    ['Strategy', cmp.baseline.method, cmp.polar_ems.method, null, null, false],
  ] as [string, string, string, number | null, string | null, boolean][] : []

  return (
    <Page title="Baseline vs POLAR-EMS" meta={station && statusBadge(station.mode)}>
      {/* QUESTION-ORIENTED SUMMARY */}
      <div className="card" style={{ borderLeft: '4px solid var(--purple)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--purple)' }}>
          DOES POLAR-EMS ACTUALLY IMPROVE OUTCOMES?
        </h3>
        <p style={{ fontSize: 13, marginBottom: 10 }}>
          Compare the <b>same station</b> under the <b>same conditions</b> with two different management strategies:
          a naive rule-based baseline (no forecasting, no optimization, no uncertainty-aware reserves) versus
          the POLAR-EMS optimized pipeline (forecast → autonomy → optimization → safety validation).
        </p>
        <div className="row">
          <button className="primary" onClick={load} disabled={busy}>
            {busy ? 'Computing…' : 'Refresh Comparison'}
          </button>
          {station && <span className="note">Current scenario: {Object.entries(station.scenario).filter(([,v]) => v).map(([k]) => k).join(', ') || 'normal'}</span>}
        </div>
      </div>

      {cmp && (
        <>
          {/* Summary */}
          <div className="section card" style={{ borderLeft: `4px solid ${cmp.delta.fuel_saved_6h_l >= 0 ? 'var(--green)' : 'var(--amber)'}` }}>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{cmp.summary}</p>
          </div>

          {/* Comparison Table */}
          <div className="section card">
            <h3>Side-by-Side Comparison (Same Scenario, Same Horizon)</h3>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Metric</th>
                  <th style={{ width: '25%' }}>Baseline (Naive)</th>
                  <th style={{ width: '25%' }}>POLAR-EMS</th>
                  <th style={{ width: '20%' }}>Improvement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, base, polar, delta, unit, showDelta], i) => (
                  <tr key={i}>
                    <td className="label-col">{label}</td>
                    <td>{base}</td>
                    <td>{polar}</td>
                    <td>
                      {showDelta && delta !== null ? (
                        <span className={delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : ''}>
                          {delta > 0 ? '+' : ''}{delta} {unit}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key Insight */}
          <div className="section card">
            <h3>What This Means</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              The baseline strategy operates reactively — it does not anticipate future demand, does not account for
              renewable generation uncertainty, and does not plan battery usage against the resupply horizon.
              POLAR-EMS continuously converts uncertain future conditions and resource constraints into a
              safety-validated operating decision, resulting in measurably different fuel consumption,
              battery management, and autonomy outcomes under the same physical conditions.
            </p>
          </div>
        </>
      )}
    </Page>
  )
}
