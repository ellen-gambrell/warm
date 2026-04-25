import { useState, useEffect, useCallback } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { useAuth } from '../context/AuthContext'

type Mode = 'checking' | 'register' | 'authenticate'

export default function Login() {
  const { login } = useAuth()
  const [mode, setMode] = useState<Mode>('checking')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doAuthenticate = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const r1 = await fetch('/api/auth/login/begin', { method: 'POST' })
      if (!r1.ok) throw new Error('Server error — try again')
      const { challengeKey, options } = await r1.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const r2 = await fetch('/api/auth/login/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_key: challengeKey, credential: assertion }),
      })
      if (!r2.ok) throw new Error('Face ID did not match')
      const { token, name: userName } = await r2.json()
      login(token, userName)
    } catch (e: unknown) {
      // User cancelled Face ID — don't show an error, just let them tap again
      const msg = e instanceof Error ? e.message : ''
      if (msg && !msg.includes('cancelled') && !msg.includes('NotAllowed')) {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }, [login])

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(({ registered }) => {
        if (registered) {
          setMode('authenticate')
          doAuthenticate()
        } else {
          setMode('register')
        }
      })
      .catch(() => setMode('register'))
  }, [doAuthenticate])

  async function doRegister() {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const r1 = await fetch('/api/auth/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!r1.ok) throw new Error('Server error — try again')
      const { challengeKey, options } = await r1.json()

      const credential = await startRegistration({ optionsJSON: options })

      const r2 = await fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_key: challengeKey, credential }),
      })
      if (!r2.ok) throw new Error('Setup failed — try again')
      const { token, name: userName } = await r2.json()
      login(token, userName)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Face ID setup failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'checking') {
    return (
      <div style={styles.center}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={{ fontSize: '5rem', lineHeight: 1 }}>🤍</div>
        <h1 style={styles.title}>Warm Care</h1>
        <p style={styles.subtitle}>
          {mode === 'register'
            ? 'Welcome. Let\'s set up your access.'
            : 'Welcome back, tap below to sign in.'}
        </p>
      </div>

      {mode === 'register' && (
        <div style={styles.form}>
          <input
            type="text"
            placeholder="Your first name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doRegister()}
            autoFocus
            style={styles.input}
            aria-label="Your first name"
          />
          <button
            onClick={doRegister}
            disabled={busy || !name.trim()}
            style={{ ...styles.btn, opacity: busy || !name.trim() ? 0.5 : 1 }}
            aria-label="Set up Face ID"
          >
            {busy ? 'Setting up…' : '🪪  Set up Face ID'}
          </button>
        </div>
      )}

      {mode === 'authenticate' && (
        <button
          onClick={doAuthenticate}
          disabled={busy}
          style={{ ...styles.btn, opacity: busy ? 0.5 : 1 }}
          aria-label="Sign in with Face ID"
        >
          {busy ? 'Checking…' : '🪪  Sign in with Face ID'}
        </button>
      )}

      {error && (
        <p role="alert" style={styles.error}>{error}</p>
      )}

      <p style={styles.legal}>
        © 2026 Quantum Moon LLC. All rights reserved.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: '2rem',
    gap: '2rem',
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--color-text)',
  },
  subtitle: {
    color: 'var(--color-text-muted)',
    fontSize: '1.1rem',
    margin: 0,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  input: {
    width: '100%',
    padding: '1rem 1.25rem',
    fontSize: '1.2rem',
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: '14px',
    color: 'var(--color-text)',
    minHeight: '64px',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    padding: '1.2rem',
    fontSize: '1.2rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: 'white',
    borderRadius: '16px',
    minHeight: '64px',
    border: 'none',
    cursor: 'pointer',
  },
  error: {
    color: 'var(--color-danger)',
    textAlign: 'center',
    fontSize: '1rem',
    margin: 0,
  },
  legal: {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    textAlign: 'center',
    margin: 0,
  },
}
