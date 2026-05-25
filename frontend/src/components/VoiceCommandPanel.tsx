import { useEffect, useRef, useState, useCallback } from 'react'
import type { Reminder } from '../context/ReminderContext'
import { parseVoiceCommand, formatInterval } from '../utils/voiceCommandParser'
import type { VoiceCommand } from '../utils/voiceCommandParser'
import { navigate } from '../App'

type AnyWindow = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any } // eslint-disable-line @typescript-eslint/no-explicit-any

const hasSpeechRecognition = !!(
  (window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition
)

const FETCH_OPTS = { credentials: 'include' as RequestCredentials }

type Phase =
  | { name: 'unavailable' }
  | { name: 'listening' }
  | { name: 'confirmation'; command: VoiceCommand & { type: Exclude<VoiceCommand['type'], 'unknown'> }; confirmText: string }
  | { name: 'unknown'; transcript: string }
  | { name: 'executing' }

interface Props {
  onClose: () => void
  reminders: Reminder[]
  activeAlert: string | null
  dismissAlert: () => void
  refreshReminders: () => Promise<void>
}

function getConfirmText(command: VoiceCommand): string {
  if (command.type === 'navigate') return `Go to ${command.destination}`
  if (command.type === 'reminder_add') return `Add a ${formatInterval(command.intervalMinutes)} reminder for "${command.label}"`
  if (command.type === 'reminder_snooze') return `Pause the "${command.reminderLabel}" reminder`
  if (command.type === 'reminder_dismiss') return `Dismiss the "${command.reminderLabel}" reminder alert`
  return ''
}

export default function VoiceCommandPanel({ onClose, reminders, activeAlert, dismissAlert, refreshReminders }: Props) {
  const [phase, setPhase] = useState<Phase>(
    hasSpeechRecognition ? { name: 'listening' } : { name: 'unavailable' }
  )
  const recognitionRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  const stopRecognition = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }

  // MEDIUM-1: focus the Confirm button when entering confirmation state
  useEffect(() => {
    if (phase.name === 'confirmation') {
      confirmBtnRef.current?.focus()
    }
  }, [phase.name])

  const startListening = useCallback(() => {
    stopRecognition()
    setPhase({ name: 'listening' })

    const SpeechRecognitionClass =
      (window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      const command = parseVoiceCommand(transcript, reminders)
      if (command.type === 'unknown') {
        setPhase({ name: 'unknown', transcript })
      } else {
        const confirmText = getConfirmText(command)
        setPhase({ name: 'confirmation', command: command as any, confirmText }) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }

    recognition.onerror = () => {
      setPhase({ name: 'unknown', transcript: '' })
    }

    // CRITICAL-1: if recognition ends without a result, transition to 'unknown'
    // so the user has exit buttons (Try again / Close) rather than being trapped.
    recognition.onend = () => {
      recognitionRef.current = null
      setPhase(p => p.name === 'listening' ? { name: 'unknown', transcript: '' } : p)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [reminders]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasSpeechRecognition) startListening()
    return stopRecognition
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    if (phase.name !== 'confirmation') return
    const { command } = phase
    setPhase({ name: 'executing' })

    try {
      if (command.type === 'navigate') {
        navigate(command.path)
        onClose()
        return
      }

      if (command.type === 'reminder_add') {
        await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...FETCH_OPTS,
          body: JSON.stringify({ label: command.label, interval_minutes: command.intervalMinutes, enabled: true }),
        })
        await refreshReminders()
        onClose()
        return
      }

      if (command.type === 'reminder_snooze') {
        await fetch(`/api/reminders/${command.reminderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          ...FETCH_OPTS,
          body: JSON.stringify({ enabled: false }),
        })
        await refreshReminders()
        onClose()
        return
      }

      if (command.type === 'reminder_dismiss') {
        if (activeAlert !== null) dismissAlert()
        onClose()
        return
      }
    } catch {
      // On any error, close gracefully rather than hanging
      onClose()
    }
  }

  const BTN: React.CSSProperties = {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    border: '2px solid var(--color-border)',
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 16px',
  }

  const BTN_PRIMARY: React.CSSProperties = {
    ...BTN,
    background: 'var(--color-accent)',
    color: 'var(--color-bg)', // HIGH-2: dark text on accent passes 7.2:1 in warm dark, readable on all themes
    border: '2px solid var(--color-accent)',
  }

  return (
    <div
      role="region"
      aria-label="Voice command"
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '14px 16px',
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {phase.name === 'unavailable' && (
        <>
          <p aria-live="polite" style={{ margin: '0 0 14px', color: 'var(--color-text)', fontSize: 16 }}>
            Voice commands require a microphone. Check your browser permissions.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={BTN} aria-label="Close voice command panel" onClick={onClose}>Close</button>
          </div>
        </>
      )}

      {/* HIGH-1: Cancel button during listening so users can exit without waiting */}
      {phase.name === 'listening' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p aria-live="polite" style={{ margin: 0, color: 'var(--color-accent)', fontWeight: 700, fontSize: 16 }}>
            🎤 Listening…
          </p>
          <button
            style={{ ...BTN, flex: 'none', minWidth: 80 }}
            aria-label="Cancel voice command"
            onClick={() => { stopRecognition(); onClose() }}
          >
            Cancel
          </button>
        </div>
      )}

      {phase.name === 'confirmation' && (
        <>
          <p aria-live="polite" style={{ margin: '0 0 14px', color: 'var(--color-text)', fontSize: 16 }}>
            I think you want to: <strong>{phase.confirmText}</strong>. Is that right?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button ref={confirmBtnRef} style={BTN_PRIMARY} aria-label={`Confirm: ${phase.confirmText}`} onClick={handleConfirm}>
              ✓ Confirm
            </button>
            <button style={BTN} aria-label="Try voice command again" onClick={startListening}>
              ✗ Try again
            </button>
          </div>
        </>
      )}

      {phase.name === 'unknown' && (
        <>
          <p aria-live="polite" style={{ margin: '0 0 14px', color: 'var(--color-text)', fontSize: 16 }}>
            I didn't catch that.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={BTN_PRIMARY} aria-label="Try voice command again" onClick={startListening}>
              Try again
            </button>
            <button style={BTN} aria-label="Close voice command panel" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}

      {phase.name === 'executing' && (
        <p aria-live="polite" style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 16 }}>
          Done…
        </p>
      )}
    </div>
  )
}
