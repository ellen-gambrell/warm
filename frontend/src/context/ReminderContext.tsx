import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'

export interface Reminder {
  id: string
  label: string
  interval_minutes: number
  enabled: boolean
  created_at: number
}

interface ReminderContextValue {
  reminders: Reminder[]
  activeAlert: string | null
  dismissAlert: () => void
  refreshReminders: () => Promise<void>
}

const ReminderContext = createContext<ReminderContextValue | null>(null)

const FETCH_OPTS = { credentials: 'include' as RequestCredentials }

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [activeAlert, setActiveAlert] = useState<string | null>(null)
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.9
    window.speechSynthesis.speak(utt)
  }, [])

  const fireReminder = useCallback((label: string) => {
    setActiveAlert(label)
    speak(label)
    // Auto-dismiss after 60 seconds if not manually dismissed
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => setActiveAlert(null), 60_000)
  }, [speak])

  const syncTimers = useCallback((list: Reminder[]) => {
    timersRef.current.forEach(t => clearInterval(t))
    timersRef.current.clear()
    for (const r of list) {
      if (!r.enabled) continue
      const ms = r.interval_minutes * 60 * 1000
      const timer = setInterval(() => fireReminder(r.label), ms)
      timersRef.current.set(r.id, timer)
    }
  }, [fireReminder])

  const refreshReminders = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/reminders', FETCH_OPTS)
      if (!res.ok) return
      const data = await res.json()
      const list: Reminder[] = data.reminders ?? []
      setReminders(list)
      syncTimers(list)
    } catch {
      // network errors are silent — don't crash the app
    }
  }, [user, syncTimers])

  useEffect(() => {
    if (user) {
      refreshReminders()
    } else {
      timersRef.current.forEach(t => clearInterval(t))
      timersRef.current.clear()
      setReminders([])
    }
    return () => {
      timersRef.current.forEach(t => clearInterval(t))
      timersRef.current.clear()
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [user, refreshReminders])

  function dismissAlert() {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    window.speechSynthesis?.cancel()
    setActiveAlert(null)
  }

  return (
    <ReminderContext.Provider value={{ reminders, activeAlert, dismissAlert, refreshReminders }}>
      {children}
    </ReminderContext.Provider>
  )
}

export function useReminders() {
  const ctx = useContext(ReminderContext)
  if (!ctx) throw new Error('useReminders must be used inside ReminderProvider')
  return ctx
}
