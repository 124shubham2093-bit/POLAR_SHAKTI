import React, { useEffect, useState } from 'react'
import { get, post, Forecast } from '../api'
import { Page, LineChart, statusBadge } from '../components'
import { useStore } from '../store'

interface ModelInfo {
  name: string
  version: string
  trained_at: number | null
  dataset: string
  metrics: Record<string, { mae: number; rmse: number; sigma: number; samples_test: number }>
  status: string
  fallback_active: boolean
  features: string[]
}

export const ForecastPage: React.FC = () => {
  const { station } = useStore()
  const [fc, setFc] = useState<Forecast | null>(null)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [hist, setHist] = useState<Record<string, number[]>>({})
  const [busy, setBusy] = useState('')

  const load = async () => {
    const [f, m, h] = await Promise.all([
      get<Forecast>('/forecast'),
      get<ModelInfo>('/forecast/model'),
      get<{ series: any[] }>('/weather/history?hours=72'),
    ])
    setFc(f)
    setModel(m)
    const temps = h.series.map((r: any) => r.temperature_c)
    const winds = h.series.map((r: any) => r.wind_speed_ms)
    setHist({ temperature: temps, wind: winds })
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 8000)
    return () => clearInterval(iv)
  }, [])

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label)
    try {
      await fn()
      await load()
    } finally {
      setBusy('')
    }
  }

  const targets = fc?.targets ?? {}
  const horas = ['1', '6', '24']

  return (
    <Page
      title="Forecast & Uncertainty"
      technicalDisclosure={true}
      meta={model && statusBadge(model.status)}
    >
      {/* QUESTION-ORIENTED SUMMARY */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--blue)' }}>
          WHAT IS LIKELY TO HAPPEN NEXT?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          {station?.scenario?.storm
            ? 'Storm conditions are increasing heating demand and reducing renewable generation. Forecast uncertainty bands have widened significantly.'
            : 'Current weather conditions are within seasonal norms. Forecasts show stable demand and renewable availability for the next 24 hours.'}
        </p>
      </div>
      {/* 1. PRIMARY UI: EXPECTED / CONSERVATIVE / HIGH DEMAND */}
      <div className="grid g3">
        {(['load_kw', 'solar_kw', 'wind_kw'] as const).map(t => {
          const s6 = targets[t]?.steps['6'] || targets[t]?.steps['24']
          const name = t === 'load_kw' ? 'STATION DEMAND' : t === 'solar_kw' ? 'SOLAR GENERATION' : 'WIND GENERATION'
          return (
            <div className="card" key={t}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{name}</h3>
                <span className="badge info">6h Ahead</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>CONSERVATIVE</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--blue)' }}>
                    {s6 ? Math.round(s6.lo) : '—'} <span style={{ fontSize: 10 }}>kW</span>
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', padding: 8, borderRadius: 4, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 10, color: '#166534', fontWeight: 600 }}>EXPECTED</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                    {s6 ? Math.round(s6.value) : '—'} <span style={{ fontSize: 10 }}>kW</span>
                  </div>
                </div>
                <div style={{ background: '#fff7ed', padding: 8, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--conserve)', fontWeight: 600 }}>HIGH DEMAND</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--conserve)' }}>
                    {s6 ? Math.round(s6.hi) : '—'} <span style={{ fontSize: 10 }}>kW</span>
                  </div>
                </div>
              </div>

              {/* Hourly Horizons breakdown */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Forecast Horizons (Conservative – High Demand)
                </div>
                {horas.map(h => {
                  const s = targets[t]?.steps[h]
                  return s ? (
                    <div key={h} className="row" style={{ justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                      <span style={{ color: 'var(--text-dim)' }}>+{h}h horizon</span>
                      <span style={{ fontFamily: 'var(--mono)' }}>
                        <b>{Math.round(s.value)} kW</b> <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>({Math.round(s.lo)} – {Math.round(s.hi)} kW)</span>
                      </span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Heating demand & weather coupling */}
      <div className="section grid g2">
        <div className="card">
          <h3>Coupled Heating Demand</h3>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 800, color: 'var(--conserve)', margin: '4px 0' }}>
            {station ? Math.round(station.balance?.heating_kw ?? 65) : '—'} kW
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Thermally coupled to ambient temperature ({station?.weather.temperature_c.toFixed(1)}°C) and wind chill ({station?.weather.wind_speed_ms.toFixed(0)} m/s).
            Heating is treated as non-sheddable life-safety load.
          </p>
        </div>

        <div className="card">
          <h3>Uncertainty Reserve Sizing</h3>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 800, color: 'var(--blue)', margin: '4px 0' }}>
            {station?.scenario?.storm ? '±25% Band' : '±10% Band'}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Under blizzard/storm conditions, renewable prediction intervals widen significantly. The LP optimizer automatically expands reserve margins to maintain positive CQRM.
          </p>
        </div>
      </div>

      {/* Historical sensor charts */}
      <div className="section grid g2">
        <div className="card">
          <h3>Ambient Temperature (72h History)</h3>
          <LineChart series={[{ data: hist.temperature ?? [], color: 'var(--blue)', label: '°C' }]} />
        </div>
        <div className="card">
          <h3>Wind Speed (72h History)</h3>
          <LineChart series={[{ data: hist.wind ?? [], color: 'var(--purple)', label: 'm/s' }]} />
        </div>
      </div>

      {/* 2. PROGRESSIVE DISCLOSURE — P10/P90 MATHEMATICAL DETAILS */}
      <details className="section">
        <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
          ▸ Technical Details (P10 / P90 Prediction Interval Methodology & Model Info)
        </summary>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <div className="card">
            <h3>Model Architecture & Training</h3>
            {model && (
              <table>
                <tbody>
                  <tr><td className="plain">Algorithm</td><td>{model.name} ({model.version})</td></tr>
                  <tr><td className="plain">Dataset</td><td>{model.dataset}</td></tr>
                  <tr><td className="plain">Trained Timestamp</td><td>{model.trained_at ? new Date(model.trained_at * 1000).toLocaleString() : '—'}</td></tr>
                  <tr><td className="plain">Inference Status</td><td>{statusBadge(model.fallback_active ? 'FALLBACK ACTIVE' : 'LOCAL MODEL ACTIVE')}</td></tr>
                  <tr><td className="plain">Interval Method</td><td>P10 / P90 Student-t calibrated residual distribution</td></tr>
                </tbody>
              </table>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="primary"
                disabled={!!busy}
                onClick={() => run('retrain', () => post('/forecast/retrain'))}
              >
                {busy === 'retrain' ? 'Training locally…' : 'Retrain on Local Station History'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Hold-Out Validation Metrics (P10 / P90 intervals)</h3>
            {model && Object.keys(model.metrics).length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Target Variable</th>
                    <th>MAE</th>
                    <th>RMSE</th>
                    <th>σ Residual</th>
                    <th>Test Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(model.metrics).map(([t, m]) => (
                    <tr key={t}>
                      <td className="plain">{t}</td>
                      <td>{m.mae.toFixed(1)}</td>
                      <td>{m.rmse.toFixed(1)}</td>
                      <td>{m.sigma.toFixed(1)}</td>
                      <td>{m.samples_test}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="note">Model metrics initializing…</p>
            )}
          </div>
        </div>
      </details>
    </Page>
  )
}
