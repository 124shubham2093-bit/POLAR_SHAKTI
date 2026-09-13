import React, { useEffect, useState } from 'react'
import { get, post } from '../api'
import { Page, statusBadge } from '../components'
import { useStore } from '../store'

export const SystemPage: React.FC = () => {
  const { station, refresh } = useStore()
  const [health, setHealth] = useState<any>(null)

  const load = () => get<any>('/system/health').then(setHealth)
  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [])

  if (!health) return <Page title="System Health"><p>Loading…</p></Page>

  const engines: [string, string][] = [
    ['DATA ENGINE', health.engines.data], ['ML ENGINE', health.engines.ml],
    ['OPTIMIZATION ENGINE', health.engines.optimizer], ['SAFETY ENGINE', health.engines.safety],
    ['DATABASE', health.database], ['LOCAL STORAGE', 'AVAILABLE'],
    ['MQTT', health.mqtt], ['INTERNET', health.internet], ['CLOUD', health.cloud],
  ]

  return (
    <Page title="System Health" meta={<span>sim time {health.sim_time_h} h</span>}>
      <div className="card">
        <h3>Engine Status</h3>
        <table>
          <tbody>
            {engines.map(([k, v]) => (
              <tr key={k}>
                <td className="plain" style={{ width: 240 }}><b>{k}</b></td>
                <td>{statusBadge(String(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(health.engines.ml_fallback_active || health.engines.optimizer_fallback_active) && (
          <div className="note" style={{ color: 'var(--amber)' }}>
            Graceful degradation active: {health.engines.ml_fallback_active && 'fallback forecasting in use. '}
            {health.engines.optimizer_fallback_active && 'rule-based safe schedule in use.'}
          </div>
        )}
      </div>

      <div className="section grid g2">
        <div className="card">
          <h3>Offline-First Design</h3>
          <p style={{ fontSize: 13 }}>
            Data processing, forecasting, autonomy, optimization, safety validation, the database and the operator
            interface all run locally. Cloud services (remote monitoring, backup, sync, model updates) are optional
            and never required for core energy management.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => post('/connectivity/simulate-loss').then(async () => { await refresh(); load() })}>
              SIMULATE INTERNET LOSS
            </button>
            <button onClick={() => post('/connectivity/restore').then(async () => { await refresh(); load() })}>
              Restore Connection
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Roles (prototype separation)</h3>
          <table>
            <tbody>
              <tr><td className="plain"><b>OPERATOR</b></td><td className="plain">view, run scenarios, approve/reject recommendations</td></tr>
              <tr><td className="plain"><b>ENGINEER</b></td><td className="plain">configure models, optimization, safety thresholds</td></tr>
              <tr><td className="plain"><b>ADMIN</b></td><td className="plain">system configuration, users, data management</td></tr>
            </tbody>
          </table>
          <div className="note">Prototype authentication is simplified; the role structure is in place for proper enforcement.</div>
        </div>
      </div>

      <div className="section card">
        <h3>Autonomy Methodology (documented in-app)</h3>
        <p style={{ fontSize: 13 }}>{station?.autonomy?.methodology}</p>
      </div>
    </Page>
  )
}
