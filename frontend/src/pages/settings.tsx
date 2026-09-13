import React, { useState } from 'react'
import { useStore } from '../store'
import { Page, statusBadge } from '../components'
import { post } from '../api'

export const SettingsPage: React.FC = () => {
  const { station, refresh } = useStore()
  const [msg, setMsg] = useState('')

  const doAction = async (action: string, params: any = {}) => {
    await post('/actions', { action, params })
    await refresh()
    setMsg(`Applied: ${action}`)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <Page title="Settings / Operator Actions" meta={station && statusBadge(station.mode)}>
      <div className="grid g2">
        <div className="card">
          <h3>Operating Mode</h3>
          <div className="row">
            {['NORMAL', 'ENERGY_CONSERVATION', 'RESUPPLY_RISK', 'CRITICAL', 'EMERGENCY'].map(m => (
              <button key={m} onClick={() => doAction('set_mode', { mode: m })}>{m}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={() => doAction('resume_auto_mode')}>Return to Automatic Mode</button>
            <span className="note">current: <b>{station?.mode}</b> ({station?.mode_auto ? 'automatic' : 'manual'})</span>
          </div>
        </div>

        <div className="card">
          <h3>Plant Overrides</h3>
          <div className="row">
            <button onClick={() => doAction('set_fuel_level', { litres: 8420 })}>Set Fuel → 8,420 L</button>
            <button onClick={() => doAction('set_fuel_level', { litres: 2500 })}>Set Fuel → 2,500 L</button>
            <button onClick={() => doAction('set_battery_soc', { soc: 62 })}>Set SOC → 62%</button>
            <button onClick={() => doAction('set_resupply_date', { days: 6 })}>Resupply → 6 days</button>
          </div>
          <div className="note">Every override is recorded in the operator-action audit trail and ripples through the
            whole system: autonomy, resupply risk, optimization, safety and alerts recalculate automatically.</div>
        </div>
      </div>

      <div className="section card">
        <h3>Auditability — "Why was this decision made?"</h3>
        <p style={{ fontSize: 13 }}>
          Every recommendation stores its input state, forecast, optimization result, safety validation and the final
          recommendation with a timestamp (see <b>Data Management → Operator Actions</b> and
          the <b>Optimization</b> page explanations). Every operator action is likewise recorded.
        </p>
      </div>

      {msg && <div className="badge safe" style={{ marginTop: 10 }}>{msg}</div>}
    </Page>
  )
}
