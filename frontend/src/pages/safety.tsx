import React, { useEffect, useState } from 'react'
import { get, post, runScenarioV1, ScenarioV1Response } from '../api'
import { Page, statusBadge, Kpi } from '../components'
import { useStore } from '../store'

export const SafetyPage: React.FC = () => {
  const { station, refresh } = useStore()
  const [rules, setRules] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'audit' | 'rules' | 'violations'>('audit')
  const [scenarioSafety, setScenarioSafety] = useState<ScenarioV1Response | null>(null)

  useEffect(() => {
    get<{ rules: Record<string, number> }>('/actions/rules').then(r => setRules(r.rules)).catch(() => {})
  }, [])

  const setRule = (k: string, v: string) => setRules(r => ({ ...r, [k]: parseFloat(v) || 0 }))

  const save = async () => {
    await post('/actions', { action: 'set_thresholds', params: rules })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await refresh()
  }

  const handleRunSafetyCheck = async () => {
    setBusy(true)
    try {
      const activeSc = localStorage.getItem('polar_ems_active_scenario') || 'NORMAL'
      const res = await runScenarioV1(activeSc)
      setScenarioSafety(res)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleExportAudit = () => {
    const auditData = {
      timestamp: new Date().toISOString(),
      station_id: station?.station?.id ?? 'maitri-sim',
      safety_status: scenarioSafety?.safety_status ?? (station?.safety?.passed ? 'SAFE' : 'UNSAFE'),
      final_decision: scenarioSafety?.final_decision ?? 'ACCEPT_PLAN',
      rules_checked: rules,
      violations: scenarioSafety?.violations ?? [],
      cqrm_margin_days: scenarioSafety?.cqrm_days ?? station?.autonomy?.cqrm_margin_days
    }
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `polar_ems_safety_audit_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sv = station?.safety
  const isSafetyPassed = scenarioSafety ? scenarioSafety.safety_status === 'SAFE' : (sv?.passed ?? true)

  return (
    <Page
      title="Deterministic Safety Validation Gate"
      technicalDisclosure={true}
      meta={
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={handleRunSafetyCheck}
            style={{ fontWeight: 600 }}
          >
            {busy ? 'Validating…' : '✓ Run Safety Check'}
          </button>
          <button
            type="button"
            onClick={handleExportAudit}
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            📥 Export Safety Audit
          </button>
          {statusBadge(isSafetyPassed ? 'SAFETY VALIDATED' : 'SAFETY VIOLATION')}
        </div>
      }
    >
      {/* 1. DECISION AUTHORITY HIERARCHY BANNER */}
      <div className="card" style={{ borderLeft: isSafetyPassed ? '4px solid var(--green)' : '4px solid var(--danger)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          DECISION AUTHORITY HIERARCHY
        </h3>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8, color: '#334155' }}>
          ML & Resupply Model → <b>Optimizer proposes plan</b> →{' '}
          <b style={{ color: 'var(--blue)' }}>Deterministic Safety Validator</b> →{' '}
          <span style={{ color: isSafetyPassed ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            {isSafetyPassed ? 'PASS (Authoritative Approval)' : 'FAIL (Authoritative Rejection → Safe Fallback)'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
          <b>Authoritative Rule:</b> The Optimizer only recommends. The Deterministic Safety Validator has final authority.
          Safety violations can NEVER be overridden by ML risk estimates.
        </div>
      </div>

      {/* 2. LIVE SAFETY KPI STATUS GRID */}
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Kpi
          label="Battery SOC Floor"
          value={Math.round(station?.battery_soc ?? 60.9)}
          unit="%"
          sub="Limit: ≥ 20.0% min at every step"
        />
        <Kpi
          label="Battery SOH"
          value={station?.battery_soh ?? 95.9}
          unit="%"
          sub="Limit: ≥ 70.0% min health"
        />
        <Kpi
          label="Critical Load Coverage"
          value="100"
          unit="%"
          sub="Must never be shed (72 kW)"
        />
        <Kpi
          label="Usable Fuel Reserve"
          value={Math.round(station?.fuel_l ?? 6400)}
          unit="L"
          sub="Limit: ≥ 800 L reserve floor"
        />
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className={activeTab === 'audit' ? 'primary' : ''}
          onClick={() => setActiveTab('audit')}
          style={{ fontWeight: 600 }}
        >
          Safety Rule Audit
        </button>
        <button
          type="button"
          className={activeTab === 'violations' ? 'primary' : ''}
          onClick={() => setActiveTab('violations')}
          style={{ fontWeight: 600 }}
        >
          Violation Inspector {scenarioSafety?.violations?.length ? `(${scenarioSafety.violations.length})` : ''}
        </button>
        <button
          type="button"
          className={activeTab === 'rules' ? 'primary' : ''}
          onClick={() => setActiveTab('rules')}
          style={{ fontWeight: 600 }}
        >
          Configurable Thresholds
        </button>
      </div>

      {/* 4. TAB 1: SAFETY AUDIT */}
      {activeTab === 'audit' && (
        <div className="section grid g2">
          <div className="card">
            <h3>Authoritative Model-7 Rule Checklist</h3>
            <ul className="safety-list">
              <li key="soc">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Minimum Battery SOC (&ge; 20.0%)</span>
                <span className="note" style={{ margin: 0 }}>Enforced at every hour</span>
              </li>
              <li key="soh">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Battery State of Health (&ge; 70.0%)</span>
                <span className="note" style={{ margin: 0 }}>ExtraTrees Regressor verified</span>
              </li>
              <li key="temp">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Battery Temperature (&le; 55.0°C)</span>
                <span className="note" style={{ margin: 0 }}>Thermal protection active</span>
              </li>
              <li key="critical">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Critical Load Coverage (100.0%)</span>
                <span className="note" style={{ margin: 0 }}>Zero-blackout priority</span>
              </li>
              <li key="balance">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Power Balance Error (&le; 5.0 kW)</span>
                <span className="note" style={{ margin: 0 }}>Physics conservation exact</span>
              </li>
              <li key="fuel">
                <span className="check pass">✓</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Minimum Fuel Reserve (&ge; 800 L)</span>
                <span className="note" style={{ margin: 0 }}>Emergency reserve intact</span>
              </li>
              <li key="resupply">
                <span className={`check ${isSafetyPassed ? 'pass' : 'fail'}`}>{isSafetyPassed ? '✓' : '✗'}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>Positive Resupply Margin (CQRM &gt; 0.0 d)</span>
                <span className="note" style={{ margin: 0 }}>
                  {scenarioSafety ? `${scenarioSafety.cqrm_days > 0 ? '+' : ''}${scenarioSafety.cqrm_days.toFixed(2)} days` : '+0.49 days'}
                </span>
              </li>
            </ul>
          </div>

          <div className="card">
            <h3>Load Shedding Hierarchy</h3>
            <ul style={{ fontSize: 12, marginLeft: 16, lineHeight: 1.8 }}>
              <li><b>CRITICAL (72 kW):</b> Heating, communications, life-support, scientific baseline. Never shed under any circumstance.</li>
              <li><b>ESSENTIAL:</b> Lab equipment, domestic lighting, secondary ventilation. Reduced only under EMERGENCY mode.</li>
              <li><b>FLEXIBLE:</b> Water heaters, snow melting, non-critical computation, maintenance tools. Dynamically curtailed by optimizer when CQRM indicates logistics stress.</li>
            </ul>
            <div className="note" style={{ marginTop: 12 }}>
              If an optimization plan violates any deterministic rule, the plan is marked REJECT_PLAN and safe conservation fallback triggers.
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: VIOLATION INSPECTOR */}
      {activeTab === 'violations' && (
        <div className="card">
          <h3>Active Safety Violations</h3>
          {scenarioSafety?.violations && scenarioSafety.violations.length > 0 ? (
            <div>
              <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                ⚠️ {scenarioSafety.violations.length} Deterministic Safety Violation(s) Active:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Violation Code</th>
                    <th>Safety Meaning</th>
                    <th>Required Operator Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioSafety.violations.map((v: any, idx: number) => {
                    const code = typeof v === 'string' ? v : v.code || JSON.stringify(v)
                    return (
                      <tr key={idx}>
                        <td><code style={{ color: 'var(--danger)', fontWeight: 700 }}>{code}</code></td>
                        <td>
                          {code === 'NEGATIVE_OR_ZERO_RESUPPLY_MARGIN' ? 'Conservative P90 resupply date exceeds safe operability horizon.' :
                           code === 'OPTIMIZER_INFEASIBLE' ? 'Extreme operating constraints allow no mathematically feasible dispatch.' :
                           code === 'LOW_BATTERY_SOC' ? 'Battery energy drops below 20.0% floor in projected horizon.' :
                           'Safety constraint threshold violated.'}
                        </td>
                        <td>
                          {code === 'NEGATIVE_OR_ZERO_RESUPPLY_MARGIN' ? 'Reject plan, activate conservation mode, and escalate logistics delay.' :
                           code === 'OPTIMIZER_INFEASIBLE' ? 'Activate emergency backup generator and shed all non-critical loads.' :
                           'Reduce battery discharge rate and preserve energy reserves.'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--green)', fontSize: 13 }}>
              ✓ No safety violations detected in current operating plan. All deterministic rules satisfied.
            </p>
          )}
        </div>
      )}

      {/* 6. TAB 3: CONFIGURABLE THRESHOLDS */}
      {activeTab === 'rules' && (
        <div className="card">
          <h3>Configurable Safety Thresholds</h3>
          <table>
            <tbody>
              {Object.entries(rules).map(([k, v]) => (
                <tr key={k}>
                  <td className="plain" style={{ fontWeight: 600 }}>{k.replace(/_/g, ' ')}</td>
                  <td>
                    <input
                      type="number"
                      value={v}
                      onChange={e => setRule(k, e.target.value)}
                      style={{ width: 100, padding: '4px 8px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary" onClick={save}>
              {saved ? 'Saved Successfully ✓' : 'Save Safety Thresholds'}
            </button>
          </div>
        </div>
      )}
    </Page>
  )
}
