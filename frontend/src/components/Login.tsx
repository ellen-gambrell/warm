/**
 * Login.tsx — sign-in card
 *
 * Primary:  Sign in with Google → /api/auth/google/login
 * Backup:   Password sign-in (for when Google is unavailable)
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import type { AuthUser } from '../context/AuthContext'

type Mode = 'loading' | 'google' | 'password' | 'request' | 'request_sent'

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: '2rem 1.5rem',
    maxWidth: 480,
    margin: '0 auto',
    gap: '1.5rem',
  },
  card: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: 24,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '0 1.25rem',
    fontSize: '1.1rem',
    background: 'var(--color-surface-raised)',
    border: '2px solid var(--color-border)',
    borderRadius: 14,
    color: 'var(--color-text)',
    minHeight: 64,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  btn: (active: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '1.2rem',
    fontSize: '1.15rem',
    fontWeight: 700,
    background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
    color: active ? '#fff' : 'var(--color-text-muted)',
    borderRadius: 16,
    minHeight: 64,
    border: 'none',
    cursor: active ? 'pointer' : 'default',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
  }),
  googleBtn: {
    width: '100%',
    padding: '1.2rem',
    fontSize: '1.15rem',
    fontWeight: 700,
    background: '#4285F4',
    color: '#fff',
    borderRadius: 16,
    minHeight: 64,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    textDecoration: 'none',
  } as React.CSSProperties,
  link: {
    background: 'none',
    border: 'none',
    padding: '8px 0',
    fontSize: '0.95rem',
    color: 'var(--color-text-muted)',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
    minHeight: 48,
  },
  error: {
    color: 'var(--color-danger)',
    fontSize: '0.95rem',
    margin: 0,
    textAlign: 'center' as const,
  },
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8rem',
    textAlign: 'center' as const,
    margin: 0,
  },
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Login() {
  const { login } = useAuth()
  const [mode, setMode]         = useState<Mode>('loading')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [reqName, setReqName]   = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqMsg, setReqMsg]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    // Check for OAuth redirect error codes
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'access_pending') {
      setError('Your access request is pending approval. Check your email for an update.')
    } else if (err === 'access_rejected') {
      setError('Your access request was not approved. Contact us if you think this is a mistake.')
    } else if (err === 'auth_failed') {
      setError('Sign-in failed. Please try again.')
    }
    if (err) {
      // Clean the URL so a reload doesn't re-show the error
      window.history.replaceState({}, '', window.location.pathname)
    }

    fetch('/api/auth/status')
      .then(r => r.json())
      .then(() => setMode('google'))
      .catch(() => setMode('google'))
  }, [])

  async function doPasswordLogin() {
    if (!email.trim() || !password) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? 'Too many attempts. Please wait 10 minutes.'
            : 'Email or password is incorrect.',
        )
      }
      login(data.profile as AuthUser)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function doRequestAccess() {
    if (!reqName.trim() || !reqEmail.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: reqName.trim(), email: reqEmail.trim().toLowerCase(), message: reqMsg.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(res.status === 429 ? 'Too many requests. Try again later.' : 'Something went wrong.')
      }
      if (data.status === 'already_registered') {
        setMode('google')
        setError('That email already has an account. Sign in with Google above.')
        return
      }
      setMode('request_sent')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '0.5rem' }}>⛅</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
          warm.care
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0', fontSize: '1rem' }}>
          {mode === 'password' ? 'Sign in with password'
            : mode === 'request' ? 'Request access'
            : mode === 'request_sent' ? 'Request submitted'
            : 'Sign in to continue'}
        </p>
      </div>

      {/* ── Card ── */}
      <div style={S.card}>

        {/* ── Google sign-in ── */}
        {mode === 'google' && (
          <>
            <a
              href="/api/auth/google/login"
              style={S.googleBtn}
              aria-label="Sign in with Google"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </a>
            <button
              style={S.link}
              onClick={() => { setMode('password'); setError('') }}
              aria-label="Sign in with password instead"
            >
              Sign in with password instead
            </button>
            <button
              style={S.link}
              onClick={() => { setMode('request'); setError('') }}
              aria-label="Request a warm.care account"
            >
              Don't have access? Request an account
            </button>
          </>
        )}

        {/* ── Request access ── */}
        {mode === 'request' && (
          <>
            <div>
              <label htmlFor="req-name" style={S.label}>Your name</label>
              <input
                id="req-name"
                type="text"
                value={reqName}
                onChange={e => setReqName(e.target.value)}
                placeholder="Your name"
                autoFocus
                autoComplete="name"
                style={S.input}
                aria-label="Your name"
              />
            </div>
            <div>
              <label htmlFor="req-email" style={S.label}>Email address</label>
              <input
                id="req-email"
                type="email"
                value={reqEmail}
                onChange={e => setReqEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={S.input}
                aria-label="Email address"
              />
            </div>
            <div>
              <label htmlFor="req-msg" style={S.label}>How will you use warm.care? (optional)</label>
              <textarea
                id="req-msg"
                value={reqMsg}
                onChange={e => setReqMsg(e.target.value)}
                placeholder="Tell us briefly how you'll use warm.care"
                rows={3}
                style={{ ...S.input, minHeight: 80, padding: '0.75rem 1.25rem', resize: 'vertical' as const }}
                aria-label="How will you use warm.care"
              />
            </div>
            <button
              onClick={doRequestAccess}
              disabled={busy || !reqName.trim() || !reqEmail.trim()}
              style={S.btn(!busy && !!reqName.trim() && !!reqEmail.trim())}
              aria-label="Submit access request"
            >
              {busy ? 'Submitting…' : 'Request Access'}
            </button>
            <button
              style={S.link}
              onClick={() => { setMode('google'); setError('') }}
              aria-label="Back to sign in"
            >
              ← Back to sign in
            </button>
          </>
        )}

        {/* ── Request sent confirmation ── */}
        {mode === 'request_sent' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem' }}>✅</div>
            <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text)' }}>
              Your request has been submitted.
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
              We'll email you when it's been reviewed.
            </p>
            <button
              style={S.link}
              onClick={() => { setMode('google'); setError('') }}
              aria-label="Back to sign in"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* ── Password (backup) ── */}
        {mode === 'password' && (
          <>
            <div>
              <label htmlFor="pw-email" style={S.label}>Email address</label>
              <input
                id="pw-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                style={S.input}
                aria-label="Email address"
              />
            </div>
            <div>
              <label htmlFor="pw-password" style={S.label}>Password</label>
              <input
                id="pw-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doPasswordLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={S.input}
                aria-label="Password"
              />
            </div>
            <button
              onClick={doPasswordLogin}
              disabled={busy || !email.trim() || !password}
              style={S.btn(!busy && !!email.trim() && !!password)}
              aria-label="Sign in with email and password"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              style={S.link}
              onClick={() => { setMode('google'); setError('') }}
              aria-label="Sign in with Google instead"
            >
              ← Sign in with Google instead
            </button>
          </>
        )}

        {error && <p role="alert" style={S.error}>{error}</p>}
      </div>

      <p style={S.muted}>© 2026 Quantum Moon LLC. All rights reserved.</p>
    </div>
  )
}
