/**
 * SupporterLogin — Google OAuth login for supporters.
 * Also handles:
 *   /supporter/accept?token=...  → invite acceptance (shows role info + Google button)
 */

import { useState, useEffect } from 'react'
import { navigate } from '../App'

const BTN: React.CSSProperties = {
  minHeight: 64,
  width: '100%',
  borderRadius: 16,
  border: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 20,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const GOOGLE_BTN: React.CSSProperties = {
  ...BTN,
  background: '#4285F4',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  textDecoration: 'none',
}

function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ── Invite acceptance ─────────────────────────────────────────────────────────

export function SupporterAcceptInvite({ token }: { token: string }) {
  const [invite, setInvite] = useState<{ email: string; role: string; role_label: string } | null>(null)
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    fetch(`/api/supporter/invite/${token}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).detail || 'Invalid invite.')
        return r.json()
      })
      .then(setInvite)
      .catch(e => setInviteError(e.message))
  }, [token])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
          You're invited ⛅
        </h1>
        <p style={{ fontSize: 20, color: 'var(--color-text-muted)', marginBottom: 32 }}>
          warm.care supporter account
        </p>

        {inviteError ? (
          <p role="alert" style={{ fontSize: 20, color: 'var(--color-danger)' }}>{inviteError}</p>
        ) : !invite ? (
          <p style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 20, border: '2px solid var(--color-border)' }}>
              <p style={{ margin: 0, fontSize: 18, color: 'var(--color-text-muted)' }}>You're joining as</p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{invite.role_label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 17, color: 'var(--color-text-muted)' }}>{invite.email}</p>
            </div>

            <p style={{ margin: 0, fontSize: 17, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Sign in with the Google account for <strong>{invite.email}</strong> to accept your invitation.
            </p>

            <a
              href={`/api/auth/google/login?portal=supporter&invite=${encodeURIComponent(token)}`}
              style={GOOGLE_BTN}
              aria-label="Accept invitation and sign in with Google"
            >
              <GoogleIcon />
              Accept &amp; sign in with Google
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main login screen ─────────────────────────────────────────────────────────

export default function SupporterLogin() {
  const params = new URLSearchParams(window.location.search)
  const errorCode = params.get('error')

  const errorMessages: Record<string, string> = {
    no_account:      'No supporter account found for that Google address.',
    revoked:         'Your access has been revoked.',
    expired:         'Your access has expired.',
    invite_expired:  'That invitation has expired. Please ask the account holder to send a new one.',
    auth_failed:     'Sign-in failed. Please try again.',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            warm.care
          </p>
          <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
            Supporter sign-in
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: 'var(--color-text-muted)' }}>
            For family, caregivers, and supporters
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errorCode && (
            <p role="alert" style={{ margin: 0, fontSize: 18, color: 'var(--color-danger)', background: 'var(--color-surface)', borderRadius: 12, padding: '12px 16px', border: '2px solid var(--color-danger)' }}>
              {errorMessages[errorCode] ?? 'Something went wrong. Please try again.'}
            </p>
          )}

          <a
            href="/api/auth/google/login?portal=supporter"
            style={GOOGLE_BTN}
            aria-label="Sign in with Google"
          >
            <GoogleIcon />
            Sign in with Google
          </a>

          <p style={{ textAlign: 'center', fontSize: 16, color: 'var(--color-text-muted)', margin: '8px 0 0' }}>
            Are you the account holder?{' '}
            <button
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: '8px 4px', minHeight: 44 }}
            >
              Sign in here →
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
