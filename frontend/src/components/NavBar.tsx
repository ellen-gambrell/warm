/**
 * NavBar — persistent Back, Home, Forward, and Voice Command buttons.
 *
 * Hard constraints (CLAUDE.md / backlog spec):
 * - All buttons are ALWAYS rendered — never hidden, never collapsed.
 * - All buttons occupy the same fixed position regardless of availability.
 * - Back/Forward disabled (not hidden) when action is unavailable.
 * - Minimum 64px tap target on all buttons.
 * - Sticky at the top of every authenticated screen.
 * - Voice command panel expands below the nav row when active.
 */

import { useState } from 'react'
import { useNav } from '../context/NavContext'
import { useReminders } from '../context/ReminderContext'
import { navigate } from '../App'
import VoiceCommandPanel from './VoiceCommandPanel'

export const NAVBAR_HEIGHT = 80 // px — nav row only; import in any view that needs to subtract it

const BTN_BASE: React.CSSProperties = {
  flex: 1,
  minHeight: 64,
  borderRadius: 14,
  border: '2px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 17,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'opacity 0.15s',
}

export default function NavBar() {
  const { back, forward, canBack, canForward } = useNav()
  const { reminders, activeAlert, dismissAlert, refreshReminders } = useReminders()
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--color-surface)',
        borderBottom: '2px solid var(--color-border)',
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="navigation"
        aria-label="Page navigation"
        style={{
          height: NAVBAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
        }}
      >
        <button
          onClick={back}
          disabled={!canBack}
          aria-label="Go back"
          aria-disabled={!canBack}
          style={{
            ...BTN_BASE,
            color: canBack ? 'var(--color-text)' : 'var(--color-text-muted)',
            opacity: canBack ? 1 : 0.38,
            cursor: canBack ? 'pointer' : 'default',
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate('/')}
          aria-label="Go home"
          style={{
            ...BTN_BASE,
            color: 'var(--color-text)',
          }}
        >
          🏠 Home
        </button>

        <button
          onClick={forward}
          disabled={!canForward}
          aria-label="Go forward"
          aria-disabled={!canForward}
          style={{
            ...BTN_BASE,
            color: canForward ? 'var(--color-text)' : 'var(--color-text-muted)',
            opacity: canForward ? 1 : 0.38,
            cursor: canForward ? 'pointer' : 'default',
          }}
        >
          Forward →
        </button>

        <button
          onClick={() => setVoiceOpen(o => !o)}
          aria-label="Voice command"
          aria-pressed={voiceOpen}
          style={{
            ...BTN_BASE,
            color: voiceOpen ? '#fff' : 'var(--color-text)',
            background: voiceOpen ? 'var(--color-accent)' : 'var(--color-surface)',
            border: voiceOpen ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
          }}
        >
          🎤
        </button>
      </div>

      {voiceOpen && (
        <VoiceCommandPanel
          onClose={() => setVoiceOpen(false)}
          reminders={reminders}
          activeAlert={activeAlert}
          dismissAlert={dismissAlert}
          refreshReminders={refreshReminders}
        />
      )}
    </div>
  )
}
