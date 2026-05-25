import { useState } from 'react'
import { useReminders } from '../context/ReminderContext'
import { useTrackVisit } from '../hooks/useTrackVisit'

const INTERVAL_OPTIONS = [
  { value: 30,   label: 'Every 30 minutes' },
  { value: 60,   label: 'Every hour' },
  { value: 120,  label: 'Every 2 hours' },
  { value: 240,  label: 'Every 4 hours' },
  { value: 480,  label: 'Every 8 hours' },
]

const BTN: React.CSSProperties = {
  minHeight: 64,
  borderRadius: 16,
  border: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 'var(--fs-md)',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const FETCH_OPTS   = { credentials: 'include' as RequestCredentials }

export default function RemindersView() {
  useTrackVisit('reminders')
  const { reminders, refreshReminders } = useReminders()
  const [showForm, setShowForm]         = useState(false)
  const [label, setLabel]               = useState('')
  const [intervalMin, setIntervalMin]   = useState(120)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  async function createReminder() {
    if (!label.trim()) return
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/reminders', {
        method: 'POST',
        headers: JSON_HEADERS,
        ...FETCH_OPTS,
        body: JSON.stringify({ label: label.trim(), interval_minutes: intervalMin, enabled: true }),
      })
      if (!r.ok) throw new Error((await r.json()).detail || 'Could not save reminder.')
      setLabel(''); setIntervalMin(120); setShowForm(false)
      await refreshReminders()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleReminder(id: string, enabled: boolean) {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      ...FETCH_OPTS,
      body: JSON.stringify({ enabled: !enabled }),
    })
    await refreshReminders()
  }

  async function confirmDeleteReminder(id: string) {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE', ...FETCH_OPTS })
    setConfirmingDeleteId(null)
    await refreshReminders()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>
        Reminders
      </h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
        Recurring voice reminders — active while the app is open.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {reminders.length === 0 && !showForm && (
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)' }}>
            No reminders yet. Add one below — a 2-hour pressure relief reminder is a good start.
          </p>
        )}

        {reminders.map(r => (
          <div
            key={r.id}
            style={{
              background: 'var(--color-surface)',
              border: `2px solid ${r.enabled ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 20,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                {r.label}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
                {INTERVAL_OPTIONS.find(o => o.value === r.interval_minutes)?.label ?? `Every ${r.interval_minutes} min`}
                {' · '}
                {r.enabled ? 'Active' : 'Paused'}
              </p>
            </div>

            <button
              onClick={() => toggleReminder(r.id, r.enabled)}
              aria-label={r.enabled ? `Pause ${r.label} reminder` : `Resume ${r.label} reminder`}
              style={{
                ...BTN,
                minHeight: 48,
                fontSize: 'var(--fs-sm)',
                background: r.enabled ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: r.enabled ? '#fff' : 'var(--color-text-muted)',
                border: '2px solid var(--color-border)',
                borderRadius: 12,
                padding: '0 16px',
                flexShrink: 0,
              }}
            >
              {r.enabled ? 'Pause' : 'Resume'}
            </button>

            {confirmingDeleteId === r.id ? (
              <>
                <button
                  onClick={() => confirmDeleteReminder(r.id)}
                  aria-label={`Confirm delete ${r.label} reminder`}
                  style={{
                    ...BTN,
                    minHeight: 64,
                    minWidth: 64,
                    fontSize: 14,
                    background: 'var(--color-danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0 12px',
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(null)}
                  aria-label="Cancel delete"
                  style={{
                    ...BTN,
                    minHeight: 64,
                    minWidth: 64,
                    fontSize: 14,
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 12,
                    padding: '0 12px',
                    flexShrink: 0,
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDeleteId(r.id)}
                aria-label={`Delete ${r.label} reminder`}
                style={{
                  ...BTN,
                  minHeight: 48,
                  minWidth: 48,
                  fontSize: 24,
                  background: 'transparent',
                  color: 'var(--color-danger)',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: 20,
          border: '2px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            Add reminder
          </h3>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              What to remind you
            </span>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createReminder() }}
              placeholder="Pressure relief, Medication, Water…"
              autoFocus
              style={{
                minHeight: 56,
                borderRadius: 12,
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
                fontSize: 18,
                padding: '0 16px',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              How often
            </span>
            <select
              value={intervalMin}
              onChange={e => setIntervalMin(Number(e.target.value))}
              style={{
                minHeight: 56,
                borderRadius: 12,
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
                fontSize: 17,
                padding: '0 16px',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {INTERVAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--color-danger)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={createReminder}
              disabled={saving || !label.trim()}
              style={{
                ...BTN,
                flex: 1,
                background: 'var(--color-accent)',
                color: '#fff',
                opacity: saving || !label.trim() ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Add reminder'}
            </button>
            <button
              onClick={() => { setShowForm(false); setLabel(''); setError('') }}
              style={{
                ...BTN,
                background: 'var(--color-surface-raised)',
                border: '2px solid var(--color-border)',
                color: 'var(--color-text)',
                padding: '0 20px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{ ...BTN, width: '100%', background: 'var(--color-accent)', color: '#fff' }}
        >
          + Add reminder
        </button>
      )}

      <p style={{ marginTop: 24, fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Reminders speak aloud and show a banner. They run while the app is open on this device.
      </p>
    </div>
  )
}
