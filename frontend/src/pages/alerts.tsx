import React, { useState } from 'react'
import { get, post } from '../api'
import { Page, fmtTime } from '../components'
import { useStore } from '../store'
import { Alert, SysEvent } from '../api'

const sevBadge = (s: string) =>
  s === 'EMERGENCY' || s === 'CRITICAL' ? 'crit' : s === 'WARNING' ? 'warn' : 'info'

export const AlertsPage: React.FC = () => {
  const { alerts, events } = useStore()
  const [showAll, setShowAll] = useState(false)
  const [all, setAll] = useState<Alert[]>([])

  const loadAll = async () => {
    const r = await get<{ alerts: Alert[] }>('/alerts?active_only=false')
    setAll(r.alerts); setShowAll(true)
  }

  const list = showAll ? all : alerts

  return (
    <Page title="Alerts & Events" meta={<button onClick={showAll ? () => setShowAll(false) : loadAll}>
      {showAll ? 'Show active only' : 'Show history'}</button>}>
      <div className="card">
        <h3>{showAll ? 'Alert History' : 'Active Alerts'} ({list.length})</h3>
        {list.length === 0 && <p className="note">No active alerts — all monitored conditions nominal.</p>}
        <table>
          <tbody>
            {list.map(a => (
              <tr key={a.id}>
                <td style={{ width: 70 }}>{fmtTime(a.ts)}</td>
                <td style={{ width: 100 }}><span className={`badge ${sevBadge(a.severity)}`}>{a.severity}</span></td>
                <td className="plain">
                  <b>{a.title}</b>
                  {a.occurrences > 1 && <span className="badge info" style={{ marginLeft: 6 }}>{a.occurrences} occurrences</span>}
                  <br /><span style={{ color: 'var(--text-dim)' }}>{a.message}</span>
                </td>
                <td style={{ width: 110 }}>
                  {a.acknowledged ? <span className="badge safe">ACK</span>
                    : <button onClick={() => post(`/alerts/ack/${a.id}`)}>Acknowledge</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="section">
        <summary>System Event Log (Audit Trail)</summary>
        <div className="card">
          <div className="eventlog">
            {events.map((e, i) => (
              <div className="ev" key={i}>
                <span className="ts">{fmtTime(e.ts)}</span>
                <span><b>[{e.source}]</b> {e.event}{e.detail ? ` — ${e.detail}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </Page>
  )
}
