import React from 'react'
import { useStore } from '../store'
import { Page, Kpi, Meter, LineChart, fmtTime } from '../components'

export const LivePage: React.FC = () => {
  const { station, events } = useStore()
  if (!station) return <Page title="Live Station Monitoring"><p>Loading…</p></Page>

  const bal = station.balance
  const w = station.weather
  const supply = bal.solar_kw + bal.wind_kw + Math.max(0, -bal.battery_kw) + bal.diesel_kw

  return (
    <Page title="Live Station Monitoring" meta={<span>{new Date().toLocaleTimeString()}</span>}>
      {/* OPERATIONAL INTERPRETATION — not raw numbers */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue)', marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--blue)' }}>
          WHAT IS HAPPENING PHYSICALLY RIGHT NOW?
        </h3>
        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>
          {(() => {
            const renewPct = supply > 0 ? Math.round((bal.solar_kw + bal.wind_kw) / supply * 100) : 0
            const battState = bal.battery_kw > 2 ? 'charging' : bal.battery_kw < -2 ? 'discharging to supplement supply' : 'idle'
            const genState = station.generator_running ? `Generator is active at ${Math.round(station.generator_output_kw)} kW` : 'Generator is on standby'
            return `Renewables currently supply ${renewPct}% of demand. Battery is ${battState}. ${genState}. Ambient temperature is ${w.temperature_c.toFixed(1)}°C with ${w.wind_speed_ms.toFixed(0)} m/s wind.`
          })()}
        </p>
      </div>
      <div className="grid g4">
        <Kpi label="Power Demand" value={Math.round(station.loads.total_kw)} unit="kW" />
        <Kpi label="Temperature" value={w.temperature_c.toFixed(1)} unit="°C" sub={w.condition} />
        <Kpi label="Wind Speed" value={w.wind_speed_ms.toFixed(1)} unit="m/s" />
        <Kpi label="Solar Irradiance" value={Math.round(w.solar_irradiance_wm2)} unit="W/m²" />
        <Kpi label="Solar Generation" value={Math.round(bal.solar_kw)} unit="kW" />
        <Kpi label="Wind Generation" value={Math.round(bal.wind_kw)} unit="kW" />
        <Kpi label="Battery Power" value={bal.battery_kw > 0 ? `+${Math.round(bal.battery_kw)}` : Math.round(bal.battery_kw)} unit="kW"
             sub={bal.battery_kw > 0 ? 'charging' : bal.battery_kw < 0 ? 'discharging' : 'idle'} />
        <Kpi label="Generator Output" value={station.generator_running ? Math.round(station.generator_output_kw) : '0'} unit="kW"
             sub={station.generator_running ? 'RUNNING' : station.generator_failed ? 'FAILED' : 'STANDBY'} />
      </div>

      <div className="section grid g2">
        <div className="card">
          <h3>Energy Balance</h3>
          <table>
            <tbody>
              <tr><td className="plain">Supply (solar + wind + discharge + diesel)</td><td>{Math.round(supply)} kW</td></tr>
              <tr><td className="plain">Load + losses</td><td>{Math.round(bal.load_kw * 1.02)} kW</td></tr>
              <tr><td className="plain">Heating component</td><td>{Math.round(bal.heating_kw ?? 0)} kW</td></tr>
              <tr><td className="plain">Battery</td><td>{bal.battery_kw >= 0 ? `charging +${Math.round(bal.battery_kw)}` : `discharging ${Math.round(bal.battery_kw)}`} kW</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Storage</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Battery SOC {Math.round(station.battery_soc)}%</span><span>SOH {station.battery_soh}%</span>
          </div>
          <Meter pct={station.battery_soc} ok={40} warn={30} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <span>Fuel {Math.round(station.fuel_l).toLocaleString()} L</span><span>{station.fuel_pct}%</span>
          </div>
          <Meter pct={station.fuel_pct} ok={40} warn={15} />
        </div>
      </div>

      <details className="section">
        <summary>Live Event Stream</summary>
        <div className="card">
          <div className="eventlog">
            {events.slice(0, 20).map((e, i) => (
              <div className="ev" key={i}>
                <span className="ts">{fmtTime(e.ts)}</span>
                <span><b>{e.source}</b> — {e.event}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="section">
        <summary>Load Trend (server-side)</summary>
        <div className="card">
          <LiveTrend />
        </div>
      </details>
    </Page>
  )
}

const LiveTrend: React.FC = () => {
  const [data, setData] = React.useState<number[]>([])
  React.useEffect(() => {
    let stop = false
    const pull = async () => {
      try {
        const res = await fetch('/api/data/readings?sensor=load_kw&limit=60').then(r => r.json())
        if (!stop) setData(res.readings.map((r: any) => r.value).reverse())
      } catch { /* keep last */ }
    }
    pull()
    const iv = setInterval(pull, 5000)
    return () => { stop = true; clearInterval(iv) }
  }, [])
  return <LineChart series={[{ data, color: 'var(--blue)', label: 'load kW' }]} />
}
