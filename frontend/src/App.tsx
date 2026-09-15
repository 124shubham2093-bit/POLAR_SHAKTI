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
import { SandboxPage } from './pages/sandbox'

const NAV_GROUPS = [
  {
    section: 'OPERATIONS',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'live', label: 'Live State' },
    ],
  },
  {
    section: 'DECISION',
    items: [
      { id: 'forecast', label: 'Forecast' },
      { id: 'autonomy', label: 'Safe Autonomy' },
      { id: 'optimization', label: 'Recommended Plan' },
      { id: 'scenarios', label: 'Scenarios' },
    ],
  },
  {
    section: 'EXPERIMENT',
    items: [
      { id: 'sandbox', label: 'Judge Sandbox' },
    ],
  },
  {
    section: 'CONTROL',
    items: [
      { id: 'resupply', label: 'Resupply' },
      { id: 'safety', label: 'Safety' },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { id: 'data', label: 'Data & Diagnostics' },
      { id: 'history', label: 'History' },
      { id: 'system', label: 'System Health' },
      { id: 'settings', label: 'Settings' },
    ],
  },
] as const

export type PageId = typeof NAV_GROUPS[number]['items'][number]['id']

export const App: React.FC = () => {
  const { station, connected, refresh, simulationPaused, toggleClock } = useStore()

  // LocalStorage and URL hash persistence for page and state
  const [page, setPage] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) return hash
    return localStorage.getItem('polar_ems_page') || 'overview'
  })

  useEffect(() => {
    localStorage.setItem('polar_ems_page', page)
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page
    }
  }, [page])

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash) setPage(hash)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Collapsible groups state with localStorage persistence
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('polar_ems_nav_collapsed')
      const initial: Record<string, boolean> = saved ? JSON.parse(saved) : {}
      initial['OPERATIONS'] = false
      initial['DECISION'] = false
      initial['EXPERIMENT'] = false
      const curPage = localStorage.getItem('polar_ems_page') || 'overview'
      const activeGroup = NAV_GROUPS.find(g => g.items.some(item => item.id === curPage))
      if (activeGroup) {
        initial[activeGroup.section] = false
      }
      return initial
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('polar_ems_nav_collapsed', JSON.stringify(collapsed))
    } catch {}
  }, [collapsed])

  // Keep/open the group containing the active page so it remains visible
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(item => item.id === page))
    if (activeGroup && collapsed[activeGroup.section]) {
      setCollapsed(prev => ({ ...prev, [activeGroup.section]: false }))
    }
  }, [page])

  const toggleGroup = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

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
    sandbox: <SandboxPage />,
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

        {NAV_GROUPS.map(group => {
          const isCollapsed = !!collapsed[group.section]
          return (
            <div key={group.section} className="nav-group">
              <button
                type="button"
                className={`nav-section ${isCollapsed ? 'collapsed' : 'expanded'}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(group.section)}
              >
                <span>{group.section}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="nav-chevron"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className={`nav-group-items ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                <div className="nav-group-items-inner">
                  {group.items.map(item => (
                    <a
                      key={item.id}
                      id={`nav-${item.id}`}
                      href={`#${item.id}`}
                      className={`nav-item ${page === item.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        setPage(item.id)
                      }}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
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
              <span className="badge critical">LOCAL MODE — CORE DECISION ENGINES ACTIVE</span>
            ) : (
              <span className="badge safe">ONLINE</span>
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

            {/* Simulation Clock Indicator (Phase 2) */}
            <button
              onClick={toggleClock}
              style={{
                background: simulationPaused ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
                border: `1px solid ${simulationPaused ? 'var(--caution)' : 'var(--green)'}`,
                color: simulationPaused ? 'var(--caution)' : 'var(--green)',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              }}
              title={simulationPaused ? 'Click to resume simulation' : 'Click to pause simulation'}
            >
              {simulationPaused ? '⏸ PAUSED' : '▶ RUNNING'}
            </button>

            <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {connected ? '3s Live Loop' : 'Connecting…'}
            </span>
          </div>
        </div>

        {/* OFFLINE LOCAL MODE BANNER (Only when offline) */}
        {isOffline && (
          <div className="offline-banner" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <b>EXTERNAL CONNECTIVITY LOST — LOCAL DECISION PATH ACTIVE</b>
              <span className="badge safe" style={{ background: '#fff', color: '#0f172a' }}>LOCAL DISPATCH ACTIVE</span>
            </div>
            <div className="offline-engines" style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
              <span>DEMAND FORECAST: ACTIVE</span>
              <span>RENEWABLE FORECAST: ACTIVE</span>
              <span>SAFE OPERABILITY: ACTIVE</span>
              <span>OPTIMIZER: ACTIVE</span>
              <span>SAFETY VALIDATOR: ACTIVE</span>
            </div>
            <div className="note" style={{ marginTop: 4, fontSize: 11, color: '#334155' }}>
              Core local decision path continues without interruption during external communication loss.
            </div>
          </div>
        )}

        {/* Render Active Page */}
        {pages[page] ?? <OverviewPage onNavigate={setPage} />}
      </main>
    </>
  )
}
