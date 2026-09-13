import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { get, post, Station, Recommendation, Alert, SysEvent } from './api'

/** Shared live system state — every page reads from this one store,
 *  mirroring the backend's shared SystemState (§56). */

interface Store {
  station: Station | null
  recommendation: Recommendation | null
  alerts: Alert[]
  events: SysEvent[]
  connected: boolean
  refresh: () => Promise<void>
  action: (path: string, body?: unknown) => Promise<any>
}

const Ctx = createContext<Store>(null as any)

export const useStore = () => useContext(Ctx)

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [station, setStation] = useState<Station | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [events, setEvents] = useState<SysEvent[]>([])
  const [connected, setConnected] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [s, r, a, e] = await Promise.all([
        get<Station>('/station'),
        get<Recommendation>('/optimization/latest'),
        get<{ alerts: Alert[] }>('/alerts'),
        get<{ events: SysEvent[] }>('/events?limit=60'),
      ])
      setStation(s)
      setRecommendation(r)
      setAlerts(a.alerts)
      setEvents(e.events)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  const action = useCallback(async (path: string, body?: unknown) => {
    const res = await post(path, body)
    await refresh()
    return res
  }, [refresh])

  useEffect(() => {
    refresh()
    const iv = setInterval(refresh, 3000)
    return () => clearInterval(iv)
  }, [refresh])

  return <Ctx.Provider value={{ station, recommendation, alerts, events, connected, refresh, action }}>{children}</Ctx.Provider>
}
