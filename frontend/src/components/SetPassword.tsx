import { useState } from 'react'
import { navigate } from '../App'

interface Props {
  token: string
}

type State = 'form' | 'submitting' | 'success' | 'error'

const BTN: React.CSSProperties = {
  width: '100%',
  minHeight: 64,
  borderRadius: 16,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: 'none',
  fontWeight: 700,
  fontSize: 18,
  transition: 'opacity 0.15s',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  height: 64,
  background: 'var(--color-surface)',
  border: '2px solid var(--color-border)',
  borderRadius: 16,
  padding: '0 16px',
  fontSize: 18,
  fontFamily: 'inherit',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

export default function SetPassword({ token }: Props) {
  const [state, setState] = useState<State>('form')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setValidationError(null)

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setValidationError('Passwords do not match.')
      return
    }

    setState('submitting')
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setApiError(err.detail || 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setState('success')
    } catch {
      setApiError('Something went wrong. Please try again.')
      setState('error')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '16px',
        maxWidth: 640,
        margin: '0 auto',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-border)',
          borderRadius: 20,
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* ── Success ── */}
        {state === 'success' && (
          <>
            <div
              role="status"
              style={{
                background: '#d4edda',
                border: '2px solid #28a745',
                borderRadius: 16,
                padding: 20,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#155724', lineHeight: 1.6 }}>
                Password set! You can now sign in with your password.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              style={{ ...BTN, background: 'var(--color-accent)', color: '#fff' }}
            >
              Go to sign in
            </button>
          </>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <>
            <p
              role="alert"
              style={{ margin: 0, fontSize: 18, color: 'var(--color-danger)', lineHeight: 1.6 }}
            >
              {apiError}
            </p>
            <button
              onClick={() => {
                setApiError(null)
                setState('form')
              }}
              style={{ ...BTN, background: 'var(--color-surface)', color: 'var(--color-text)', border: '2px solid var(--color-border)' }}
            >
              Try again
            </button>
          </>
        )}

        {/* ── Form ── */}
        {(state === 'form' || state === 'submitting') && (
          <>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--color-text)' }}>
              Set your password
            </h1>

            <div>
              <label
                htmlFor="new-password"
                style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={INPUT}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={INPUT}
              />
            </div>

            {validationError && (
              <p
                role="alert"
                style={{ margin: 0, fontSize: 16, color: 'var(--color-danger)' }}
              >
                {validationError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={state === 'submitting'}
              style={{
                ...BTN,
                background: 'var(--color-accent)',
                color: '#fff',
                opacity: state === 'submitting' ? 0.7 : 1,
              }}
            >
              {state === 'submitting' ? 'Saving…' : 'Set password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
