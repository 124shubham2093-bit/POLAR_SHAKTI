import React, { useEffect, useState } from 'react'
import { useStore } from './store'
import { statusBadge, SyntheticTopBadge } from './components'
import { post } from './api'

// Page components
import { OverviewPage } from './pages/overview'
import { LivePage } from './pages/live'
import { DataPage } from './pages/data'
import { ForecastPage } from './pages/forecast'
import { AutonomyPage } from './pages/autonomy'
import { OptimizationPage } from './pages/optimization'
import { SafetyPage } from './pages/safety'
import { ResupplyPage } from './pages/resupply'
import { ScenariosPage } from './pages/scenarios'
import { BaselinePage } from './pages/baseline'
import { AlertsPage } from './pages/alerts'
import { HistoryPage } from './pages/history'
import { SystemPage } from './pages/system'
import { SettingsPage } from './pages/settings'

const NAV = [
  { section: 'Operations' },
  { id: 'overview', label: 'Overview' },
  { id: 'live', label: 'Live State' },

  { section: 'Decision' },
  { id: 'optimization', label: 'Operating Plan' },
  { id: 'forecast', label: 'Forecast & Uncertainty' },
  { id: 'autonomy', label: 'Safe Operability & CQRM' },
  { id: 'scenarios', label: 'Scenarios & Stress Demo' },
  { id: 'baseline', label: 'Baseline Comparison' },

  { section: 'Control' },
  { id: 'safety', label: 'Safety Validation Gate' },
  { id: 'resupply', label: 'Resupply Logistics' },

  { section: 'System' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'data', label: 'Data Diagnostics' },
  { id: 'history', label: 'Action Audit' },
  { id: 'system', label: 'System Health' },
  { id: 'settings', label: 'Settings' },
] as const

export type PageId = typeof NAV[number] extends { id: infer I } ? I : never

export const App: React.FC = () => {
  const { station, connected, refresh } = useStore()

  // LocalStorage persistence for page and state
  const [page, setPage] = useState<string>(() => {
    return localStorage.getItem('polar_ems_page') || 'overview'
  })

  useEffect(() => {
    localStorage.setItem('polar_ems_page', page)
  }, [page])

  // Restore delay state from localStorage on first mount if present
  useEffect(() => {
    const savedDelay = localStorage.getItem('polar_ems_resupply_delay')
    if (savedDelay) {
      const d = parseFloat(savedDelay)
      if (!isNaN(d) && d > 0) {
        post('/resupply/delay', { delay_days: d }).catch(() => {})
      }
    }
  }, [])

  const pages: Record<string, React.ReactNode> = {
    overview: <OverviewPage onNavigate={setPage} />,
    live: <LivePage />,
    data: <DataPage />,
    forecast: <ForecastPage />,
    autonomy: <AutonomyPage />,
    optimization: <OptimizationPage />,
    safety: <SafetyPage />,
    resupply: <ResupplyPage />,
    scenarios: <ScenariosPage />,
    baseline: <BaselinePage />,
    alerts: <AlertsPage />,
    history: <HistoryPage />,
    system: <SystemPage />,
    settings: <SettingsPage />,
  }

  const isOffline = station && station.connectivity.internet !== 'ONLINE'

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <h1>POLAR-EMS</h1>
          <div className="sub">AUTONOMY-AWARE ENERGY MANAGEMENT</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Maitri Station Simulation
            </span>
          </div>
        </div>

        {NAV.map(item =>
          'section' in item ? (
            <div className="nav-section" key={item.section}>{item.section}</div>
          ) : (
            <a
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </a>
          ),
        )}
      </aside>

      <main className="main">
        {/* TOP BAR: Persistent Synthetic Label + Live System Status */}
        <div className="topbar">
          <div className="row" style={{ gap: 10 }}>
            {/* 1. PERSISTENT SYNTHETIC DATA LABEL (Locked Decision 1) */}
            <SyntheticTopBadge />

            {/* Operating Mode Badge */}
            {statusBadge(station ? station.mode : 'OFFLINE')}

            {isOffline ? (
              <span className="badge critical">OFFLINE — LOCAL ENGINE ACTIVE</span>
            ) : (
              <span className="badge safe">ONLINE (OFFLINE-READY)</span>
            )}

            <span
              className="dot"
              style={{ background: connected ? 'var(--green)' : 'var(--red)' }}
              title={connected ? 'Polling active' : 'Offline'}
            />
          </div>

          <div className="row" style={{ fontSize: 12, color: 'var(--text-dim)', gap: 14 }}>
            <span>
              Resupply: <b>{station ? `${station.resupply.in_days.toFixed(1)} d` : '—'}</b>
              {station?.resupply?.delay_days ? (
                <span style={{ color: 'var(--conserve)', marginLeft: 4 }}>
                  (+{station.resupply.delay_days.toFixed(0)}d delay)
                </span>
              ) : null}
            </span>
            {station && !station.mode_auto && <span className="badge caution">MANUAL OVERRIDE</span>}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {connected ? '3s Live Loop' : 'Connecting…'}
            </span>
          </div>
        </div>

        {/* OFFLINE LOCAL MODE BANNER (Only when offline) */}
        {isOffline && (
          <div className="offline-banner" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>SATELLITE LINK SEVERED — 100% AUTONOMOUS LOCAL DISPATCH ACTIVE</b>
              <span className="badge safe" style={{ background: '#fff' }}>ZERO CLOUD DEPENDENCY</span>
            </div>
            <div className="offline-engines">
              <span>LOCAL FORECAST: ACTIVE</span>
              <span>LOCAL LP OPTIMIZATION: ACTIVE</span>
              <span>SAFETY GATE: ACTIVE</span>
              <span>CQRM ENGINE: ACTIVE</span>
              <span>LOCAL DB: ACTIVE</span>
            </div>
            <div className="note" style={{ marginTop: 4 }}>
              Core survival algorithms continue running on station hardware without interruption.
            </div>
          </div>
        )}

        {/* Render Active Page */}
        {pages[page] ?? <OverviewPage onNavigate={setPage} />}
      </main>
    </>
  )
}
