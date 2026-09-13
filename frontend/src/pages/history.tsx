import React, { useEffect, useState } from 'react'
import { get } from '../api'
import { Page, LineChart, Kpi } from '../components'

interface Run { id: number; ts: number; status: string; method: string; objective: number | null }

export const HistoryPage: React.FC = () => {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [series, setSeries] = useState<Record<string, number[]>>({})
  const [runs, setRuns] = useState<Run[]>([])
  const [quality, setQuality] = useState<{ score: number; issues: string[] }>({ score: 100, issues: [] })

  useEffect(() => {
    const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720
    const cutoff = Date.now() / 1000 - hours * 3600
    Promise.all([
      get<{ readings: any[] }>(`/data/readings?limit=3000`),
      get<{ runs: Run[] }>('/data/schedules'),
      get<any>('/sensors/quality'),
    ]).then(([rd, r, q]) => {
      const rows = rd.readings.filter((x: any) => x.ts >= cutoff).reverse()
      const pick = (s: string) => rows.filter((r: any) => r.sensor === s).map((r: any) => r.value)
      setSeries({
        load: pick('load_kw'),
        solar: pick('solar_kw'),
        wind: pick('wind_kw'),
        soc: pick('battery_soc'),
      })
      setRuns(r.runs.slice(0, 15))
      setQuality(q)
    })
  }, [range])

  return (
    <Page title="Historical Analytics" meta={
      <div className="row">
        {(['24h', '7d', '30d'] as const).map(r => (
          <button key={r} className={range === r ? 'primary' : ''} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>
    }>
      <div className="grid g3">
        <Kpi label="Data Quality Score" value={quality.score} unit="%" sub={quality.issues.join(', ') || 'no issues detected'} />
        <Kpi label="Optimization Runs" value={runs.length} sub={`latest: ${runs[0]?.method ?? '—'}`} />
        <Kpi label="Last Run Objective" value={runs[0]?.objective ?? '—'} unit="L diesel / 6 h" />
      </div>

      <div className="section grid g2">
        <div className="card"><h3>Station Load (kW)</h3>
          <LineChart series={[{ data: series.load ?? [], color: 'var(--blue)', label: 'load' }]} /></div>
        <div className="card"><h3>Battery SOC (%)</h3>
          <LineChart series={[{ data: series.soc ?? [], color: 'var(--green)', label: 'soc' }]} yMin={0} yMax={100} /></div>
        <div className="card"><h3>Solar Generation (kW)</h3>
          <LineChart series={[{ data: series.solar ?? [], color: 'var(--amber)', label: 'solar' }]} /></div>
        <div className="card"><h3>Wind Generation (kW)</h3>
          <LineChart series={[{ data: series.wind ?? [], color: 'var(--purple)', label: 'wind' }]} /></div>
      </div>

      <div className="section card">
        <h3>Optimization Run History</h3>
        <table>
          <thead><tr><th>Time</th><th>Status</th><th>Method</th><th>Objective (L diesel)</th></tr></thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.ts * 1000).toLocaleString()}</td>
                <td>{r.status}</td><td>{r.method}</td><td>{r.objective ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}
