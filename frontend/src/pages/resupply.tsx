import React, { useState } from 'react'
import { useStore } from '../store'
import { Page, statusBadge, ResupplyDelaySlider } from '../components'
import { post, Autonomy } from '../api'

export const ResupplyPage: React.FC = () => {
  const { station, action } = useStore()
  const [form, setForm] = useState({
    resupply_date_days: '',
    expected_fuel_l: '',
    fuel_l: '',
    battery_soc: '',
  })
  const [result, setResult] = useState<Autonomy | null>(null)

  if (!station) return <Page title="Resupply Logistics"><p>Loading…</p></Page>

  const a = result ?? station.autonomy
  const model = station.resupply?.model
  const delayDays = station.resupply?.delay_days ?? model?.slider_delay_days ?? 0

  const submit = async () => {
    const params: any = {}
    if (form.resupply_date_days) params.resupply_date_days = parseFloat(form.resupply_date_days)
    if (form.expected_fuel_l) params.expected_fuel_l = parseFloat(form.expected_fuel_l)
    if (form.fuel_l) params.fuel_l = parseFloat(form.fuel_l)
    if (form.battery_soc) params.battery_soc = parseFloat(form.battery_soc)
    const r = await post<{ autonomy: Autonomy }>('/resupply/configure', params)
    setResult(r.autonomy)
  }

  const margin = a?.cqrm_margin_days ?? a?.autonomy_margin_days ?? 0
  const heroClass =
    !a ? 'safe' :
    a.status === 'SAFE' ? 'safe' :
    a.status === 'CAUTION' ? 'caution' :
    a.status === 'CONSERVE' ? 'conserve' : 'critical'

  return (
    <Page
      title="Resupply Logistics"
      technicalDisclosure={true}
      meta={a && statusBadge(a.status)}
    >
      {/* QUESTION-ORIENTED SUMMARY */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--blue)' }}>
          WHEN CAN RESUPPLY REALISTICALLY ARRIVE?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          {margin < 0
            ? `Resupply may arrive after the safe operability horizon. Current deficit is ${Math.abs(margin).toFixed(1)} days.`
            : `Resupply is expected within the safe operability window with a ${margin.toFixed(1)}-day margin.`}
        </p>
      </div>

      {/* 1. Hero Card */}
      <div className={`hero-autonomy ${heroClass}`}>
        <div>
          <div className="hero-label">RESUPPLY ARRIVAL WINDOW</div>
          <div className="hero-value">{a?.next_resupply_days ? a.next_resupply_days.toFixed(1) : station.resupply.in_days.toFixed(1)}</div>
          <div className="hero-unit">DAYS</div>
        </div>
        <div className="hero-meta">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{statusBadge(a?.status ?? 'SAFE')}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800,
              color: margin >= 2 ? 'var(--green)' : margin >= 0 ? 'var(--amber)' : 'var(--red)' }}>
              {margin >= 0 ? `+${margin.toFixed(1)}` : margin.toFixed(1)}d margin
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span>Safe Operability: <b>{a?.safe_autonomy_days?.toFixed(1) ?? '—'} days</b></span>
          </div>
          {margin < 0 && (
            <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
              DEFICIT WINDOW DETECTED: Station may exhaust energy reserves {Math.abs(margin).toFixed(1)} days before convoy arrival.
            </div>
          )}
        </div>
      </div>

      {/* WHY IS RESUPPLY UNCERTAIN? */}
      <div className="section card" style={{ marginTop: 14 }}>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', margin: '0 0 8px' }}>
          WHY IS RESUPPLY UNCERTAIN?
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, fontSize: 12 }}>
          <div><b>Weather:</b> {model?.weather_impact || 'Normal seasonal variability'}</div>
          <div><b>Season:</b> Antarctic access window constraints</div>
          <div><b>Transport:</b> Ice-shelf convoy / vessel logistics</div>
          <div><b>Delay:</b> {delayDays > 0 ? `+${delayDays.toFixed(0)} days added via scenario` : 'No additional delay'}</div>
        </div>
      </div>

      {/* 2. Interactive Resupply Delay Slider */}
      <div className="section">
        <ResupplyDelaySlider
          delayDays={delayDays}
          onChange={(days) => action('/resupply/delay', { delay_days: days })}
        />
      </div>

      {/* 3. Probabilistic Daily Arrival Distribution Table */}
      {model?.daily_distribution && (
        <div className="section card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h3>Probabilistic Arrival Density (Weather-Gated Weibull)</h3>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Weather Factor: +{model.weather_delay_factor_days}d ({model.weather_impact})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 110, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {model.daily_distribution.map((d) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '80%',
                    height: `${Math.max(4, Math.round(d.marginal_probability * 180))}px`,
                    background: d.day === Math.round(model.expected_days) ? 'var(--blue)' : '#cbd5e1',
                    borderRadius: 2,
                  }}
                  title={`Day ${d.day}: ${Math.round(d.marginal_probability * 100)}% marginal probability`}
                />
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                  d{d.day}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            <span>Optimistic (P10): <b>{model.optimistic_days} d</b></span>
            <span>Expected Arrival: <b>{model.expected_days} d</b></span>
            <span>Conservative Planning (P90): <b>{model.conservative_days} d</b></span>
          </div>
        </div>
      )}

      {/* 4. Configuration Form */}
      <div className="section grid g2">
        <div className="card">
          <h3>Manual Resupply Parameters</h3>
          <div className="grid g2">
            <div>
              <label>Next Convoy Scheduled (days)</label>
              <input
                value={form.resupply_date_days}
                onChange={e => setForm({ ...form, resupply_date_days: e.target.value })}
                placeholder={`${station.resupply.in_days.toFixed(1)}`}
              />
            </div>
            <div>
              <label>Expected Resupply Fuel (L)</label>
              <input
                value={form.expected_fuel_l}
                onChange={e => setForm({ ...form, expected_fuel_l: e.target.value })}
                placeholder={`${station.resupply.expected_fuel_l}`}
              />
            </div>
            <div>
              <label>Current Fuel (L)</label>
              <input
                value={form.fuel_l}
                onChange={e => setForm({ ...form, fuel_l: e.target.value })}
                placeholder={`${Math.round(station.fuel_l)}`}
              />
            </div>
            <div>
              <label>Battery SOC (%)</label>
              <input
                value={form.battery_soc}
                onChange={e => setForm({ ...form, battery_soc: e.target.value })}
                placeholder={`${Math.round(station.battery_soc)}`}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary" onClick={submit}>
              Update Horizon
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Station Energy Reserves</h3>
          <table>
            <tbody>
              <tr><td className="plain">Usable Fuel</td><td>{Math.round(station.fuel_l).toLocaleString()} L ({Math.round(station.fuel_pct)}%)</td></tr>
              <tr><td className="plain">Emergency Fuel Floor</td><td>1,500 L (Mandatory Reserve)</td></tr>
              <tr><td className="plain">Battery Storage</td><td>{Math.round(station.battery_soc)}% SOC / {station.battery_soh}% SOH</td></tr>
              <tr><td className="plain">Critical Demand Floor</td><td>{station.loads.critical_kw} kW (Zero-Blackout)</td></tr>
              <tr><td className="plain">Incoming Cargo</td><td>{station.resupply.expected_fuel_l.toLocaleString()} L Arctic Diesel</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  )
}
