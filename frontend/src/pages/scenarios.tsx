import React, { useState } from 'react'
import { post } from '../api'
import { Page, statusBadge, ResupplyDelaySlider, DemoControlStrip } from '../components'
import { useStore } from '../store'

export const ScenariosPage: React.FC = () => {
  const { station, refresh, action } = useStore()
  const [activeScenario, setActiveScenario] = useState('')
  const [busy, setBusy] = useState(false)

  const demoState = station?.demo_state
  const delayDays = station?.resupply?.delay_days ?? station?.resupply?.model?.slider_delay_days ?? 0

  const activate = async (id: string) => {
    setBusy(true)
    try {
      setActiveScenario(id)
      await post(`/scenarios/activate/${id}`)
      localStorage.setItem('polar_ems_selected_scenario', id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleSliderChange = async (days: number) => {
    await action('/resupply/delay', { delay_days: days })
    localStorage.setItem('polar_ems_resupply_delay', String(days))
  }

  const handleDemoStart = async () => {
    await post('/scenarios/demo/start', {})
    await refresh()
  }

  const handleDemoNext = async () => {
    await post('/scenarios/demo/next', {})
    await refresh()
  }

  const handleDemoPrev = async () => {
    await post('/scenarios/demo/prev', {})
    await refresh()
  }

  const handleDemoPause = async () => {
    await post('/scenarios/demo/pause', {})
    await refresh()
  }

  const handleDemoStop = async () => {
    await post('/scenarios/demo/stop', {})
    await refresh()
  }

  const isStormActive = station?.scenario?.storm || station?.scenario?.bad_weather
  const isCommsLoss = station?.connectivity?.internet !== 'ONLINE'

  return (
    <Page
      title="Scenario Simulator & Stress Testing"
      technicalDisclosure={true}
      meta={station && statusBadge(station.mode)}
    >
      {/* 1. STEP-CONTROLLED DEMO CONTROLLER */}
      {demoState?.active ? (
        <DemoControlStrip
          demoState={demoState}
          onNext={handleDemoNext}
          onPrev={handleDemoPrev}
          onPause={handleDemoPause}
          onStop={handleDemoStop}
        />
      ) : (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--purple)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 13, color: 'var(--purple)', fontWeight: 700 }}>
              GUIDED 7-STEP JUDGE DEMONSTRATION FLOW
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              Step-by-step stress sequence: Normal → Blizzard → Convoy Halt → CQRM Deficit → Optimizer Replan → Safety Gate → Offline Autonomy.
            </p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={handleDemoStart}
            style={{ fontWeight: 700, padding: '7px 16px' }}
          >
            ▶ START DEMO
          </button>
        </div>
      )}

      {/* 2. PRIMARY DEMO SCENARIOS (3 Main Cards) */}
      <div className="section">
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700, color: 'var(--text)' }}>
          PRIMARY DEMO SCENARIOS
        </h3>
        <div className="grid g3">
          {/* Card 1: STORM */}
          <div className="card" style={{ borderTop: isStormActive ? '4px solid var(--blue)' : '4px solid var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>1. ANTARCTIC BLIZZARD / STORM</h4>
              {isStormActive && <span className="badge info">ACTIVE</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, minHeight: 48 }}>
              28 m/s wind gusts, -30°C temperature drop, solar generation cut to ~15 W/m², and heating demand surges to 240+ kW.
            </p>
            <button
              type="button"
              className={isStormActive ? 'primary' : ''}
              onClick={() => activate('storm')}
              disabled={busy}
              style={{ width: '100%', fontWeight: 600 }}
            >
              {isStormActive ? 'Blizzard Active' : 'Activate Blizzard'}
            </button>
          </div>

          {/* Card 2: RESUPPLY DELAY */}
          <div className="card" style={{ borderTop: delayDays > 0 ? '4px solid var(--conserve)' : '4px solid var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>2. RESUPPLY DELAY</h4>
              {delayDays > 0 && <span className="badge conserve">+{delayDays.toFixed(0)}d DELAY</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, minHeight: 48 }}>
              Sea-ice fissures halt supply convoy. Directly alters the resupply arrival distribution and triggers chance-constrained replan.
            </p>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>Adjust Convoy Delay:</span>
                <b style={{ color: 'var(--blue)', fontFamily: 'var(--mono)' }}>+{delayDays.toFixed(0)} days</b>
              </div>
              <input
                type="range"
                min="0"
                max="7"
                step="1"
                value={delayDays}
                onChange={e => handleSliderChange(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Card 3: COMMUNICATION LOSS */}
          <div className="card" style={{ borderTop: isCommsLoss ? '4px solid var(--amber)' : '4px solid var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>3. COMMUNICATION LOSS</h4>
              {isCommsLoss ? <span className="badge caution">OFFLINE</span> : <span className="badge safe">ONLINE</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, minHeight: 48 }}>
              Sever satellite connection. Demonstrates that forecasting, LP optimization, safety validation, and data persistence remain 100% operational offline.
            </p>
            <button
              type="button"
              className={isCommsLoss ? 'danger' : ''}
              onClick={() => activate(isCommsLoss ? 'normal' : 'internet_failure')}
              disabled={busy}
              style={{ width: '100%', fontWeight: 600 }}
            >
              {isCommsLoss ? 'Restore Connectivity' : 'Sever Satellite Link'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. SECONDARY SCENARIOS (Compact Clean Grid) */}
      <div className="section card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 700, color: 'var(--text-dim)' }}>
          OTHER OPERATIONAL STRESS SCENARIOS
        </h3>
        <p className="note" style={{ marginBottom: 12 }}>
          Secondary failure modes and seasonal variations:
        </p>
        <div className="grid g5">
          <button
            type="button"
            className={activeScenario === 'low_wind' ? 'primary' : ''}
            onClick={() => activate('low_wind')}
            style={{ textAlign: 'left', padding: '10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>Low Wind</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Wind calm (2 m/s), turbines idle</div>
          </button>

          <button
            type="button"
            className={activeScenario === 'low_renewable' ? 'primary' : ''}
            onClick={() => activate('low_renewable')}
            style={{ textAlign: 'left', padding: '10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>Low Solar</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Polar night (0 W/m² irradiance)</div>
          </button>

          <button
            type="button"
            className={activeScenario === 'high_heating' ? 'primary' : ''}
            onClick={() => activate('high_heating')}
            style={{ textAlign: 'left', padding: '10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>Heating Spike</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Deep freeze (-38°C) thermal surge</div>
          </button>

          <button
            type="button"
            className={activeScenario === 'generator_failure' ? 'primary' : ''}
            onClick={() => activate('generator_failure')}
            style={{ textAlign: 'left', padding: '10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>Gen Failure</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Diesel trips, battery only</div>
          </button>

          <button
            type="button"
            className={activeScenario === 'combined_extreme' ? 'primary' : ''}
            onClick={() => activate('combined_extreme')}
            style={{ textAlign: 'left', padding: '10px' }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>Combined Extreme</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Blizzard + Delay + Cold simultaneously</div>
          </button>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => activate('normal')}
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            ↺ Reset to Normal Nominal Operation
          </button>
        </div>
      </div>
    </Page>
  )
}
