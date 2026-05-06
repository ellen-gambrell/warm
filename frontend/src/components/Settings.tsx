/**
 * Settings page — /settings
 *
 * Sections
 * ────────
 * Connected services  Gmail · Google Drive · Venmo
 * Account             Set / change password
 * Sign out
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useProfile } from '../context/ProfileContext'

// ── Supporter management types ─────────────────────────────────────────────────

interface SupporterAccount {
  id: string
  name: string
  email: string
  role: string
  role_label: string
  revoked: boolean
  last_active_at: number | null
}

interface PendingInvite {
  id: string
  email: string
  role: string
  role_label: string
  expires_at: number
}

const SUPPORTER_ROLES = [
  { value: 'key_contact',       label: 'Key Contact — manages all other supporters' },
  { value: 'family_secondary',  label: 'Family — can update menu & view schedule' },
  { value: 'homemaker',         label: 'Homemaker — tasks, shopping, schedule' },
  { value: 'pca',               label: 'Personal Care Attendant' },
  { value: 'home_health_aide',  label: 'Home Health Aide' },
  { value: 'respite',           label: 'Respite — temporary cover (requires end date)' },
  { value: 'nurse_medical',     label: 'Nurse' },
  { value: 'therapist',         label: 'Therapist (OT / PT / Speech)' },
  { value: 'case_manager',      label: 'Case Manager / Social Worker' },
  { value: 'financial_manager', label: 'Financial Manager' },
  { value: 'transportation',    label: 'Transportation' },
  { value: 'sdm_supporter',     label: 'SDM Supporter' },
]

// ── Styles ─────────────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  minHeight: 64,
  borderRadius: 16,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: 'none',
  fontWeight: 700,
  fontSize: 18,
  transition: 'opacity 0.15s',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConnectionStatus {
  gmail: boolean
  drive: boolean
  venmo: boolean
  monarch: boolean
}

// ── Helper: JSON headers (auth via cookie, not Bearer) ────────────────────────

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const FETCH_OPTS   = { credentials: 'include' as RequestCredentials }

// ── Connection card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  icon: string
  label: string
  description: string
  accentColor: string
  connected: boolean
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  children?: React.ReactNode
  inlineError?: string          // show error inside the card (won't scroll off-screen)
}

function ServiceCard({
  icon, label, description, accentColor,
  connected, busy, onConnect, onDisconnect, children, inlineError,
}: ServiceCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${connected ? accentColor : 'var(--color-border)'}`,
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 36 }} role="img" aria-hidden="true">{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
            {connected && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: accentColor,
                  background: `${accentColor}18`,
                  borderRadius: 99,
                  padding: '2px 10px',
                }}
              >
                Connected ✓
              </span>
            )}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 15, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            {description}
          </p>
        </div>
      </div>

      {/* Extra content (e.g. credential inputs) */}
      {children}

      {/* Inline error — visible without scrolling */}
      {inlineError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: '#3a1a1a',
            color: '#ff7f7f',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {inlineError}
        </div>
      )}

      {/* Action button */}
      {connected ? (
        <button
          onClick={onDisconnect}
          disabled={busy}
          aria-label={`Disconnect ${label}`}
          style={{
            ...BTN,
            width: '100%',
            background: 'transparent',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 17,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={busy}
          aria-label={`Connect ${label}`}
          style={{
            ...BTN,
            width: '100%',
            background: accentColor,
            color: '#fff',
            fontSize: 18,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Connecting…' : `Connect ${label}`}
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, logout } = useAuth()
  const { themeId, themes, setTheme } = useTheme()
  const { profile, setProfile } = useProfile()
  const [status, setStatus]   = useState<ConnectionStatus | null>(null)
  const [busy, setBusy]       = useState<Record<string, boolean>>({})
  const [notice, setNotice]   = useState<{ msg: string; ok: boolean } | null>(null)

  // Venmo username field
  const [venmoUsername, setVenmoUsername] = useState('')
  const [_venmoSaving, setVenmoSaving]    = useState(false)

  // Monarch Money credential fields
  const [monarchEmail,    setMonarchEmail]    = useState('')
  const [monarchPassword, setMonarchPassword] = useState('')
  const [monarchOtp,      setMonarchOtp]      = useState('')
  const [monarchShowPw,   setMonarchShowPw]   = useState(false)
  const [monarchNeedsMfa, setMonarchNeedsMfa] = useState(false)
  const [monarchConnectedEmail, setMonarchConnectedEmail] = useState('')
  const [monarchError, setMonarchError] = useState('')

  // Password email request
  const [pwBusy, setPwBusy]   = useState(false)
  const [pwNotice, setPwNotice] = useState('')

  // Supporter management
  const [supporters, setSupporters] = useState<SupporterAccount[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [supportersLoading, setSupportersLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('family_secondary')
  const [inviteExpiry, setInviteExpiry] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load connection status & handle OAuth redirect params ──────────────────

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error     = params.get('error')

    // Clean URL
    if (connected || error) {
      window.history.replaceState(null, '', '/settings')
    }

    if (connected) showNotice(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected!`, true)
    if (error)     showNotice(friendlyOAuthError(error), false)

    fetchStatus()
  }, [user])

  // Also fetch Venmo username when status loads
  useEffect(() => {
    if (status?.venmo && user) {
      fetch('/api/connections/venmo', { ...FETCH_OPTS })
        .then(r => r.json())
        .then(d => { if (d.username) setVenmoUsername(d.username) })
        .catch(() => {})
    }
  }, [status?.venmo])

  // Fetch Monarch connected email when status loads
  useEffect(() => {
    if (status?.monarch && user) {
      fetch('/api/connections/monarch', { ...FETCH_OPTS })
        .then(r => r.json())
        .then(d => { if (d.email) setMonarchConnectedEmail(d.email) })
        .catch(() => {})
    }
  }, [status?.monarch])

  function fetchStatus() {
    if (!user) return
    fetch('/api/connections/status', { ...FETCH_OPTS })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }

  const fetchSupporters = useCallback(() => {
    fetch('/api/margaret/supporters', { ...FETCH_OPTS })
      .then(r => r.json())
      .then(d => {
        setSupporters(d.supporters ?? [])
        setPendingInvites(d.pending_invites ?? [])
      })
      .catch(() => {})
      .finally(() => setSupportersLoading(false))
  }, [])

  useEffect(() => { if (user) fetchSupporters() }, [user, fetchSupporters])

  async function sendInvite() {
    setInviteError(''); setInviteMsg('')
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (inviteRole === 'respite' && !inviteExpiry) {
      setInviteError('Respite role requires an end date.')
      return
    }
    setInviting(true)
    try {
      const body: Record<string, unknown> = { email, role: inviteRole }
      if (inviteExpiry) body.expires_at = Math.floor(new Date(inviteExpiry).getTime() / 1000)
      const r = await fetch('/api/margaret/supporters/invite', {
        method: 'POST', headers: JSON_HEADERS, ...FETCH_OPTS, body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error((await r.json()).detail || 'Could not send invite.')
      setInviteMsg(`Invite sent to ${email} ✓`)
      setInviteEmail(''); setInviteRole('family_secondary'); setInviteExpiry('')
      setShowInviteForm(false)
      fetchSupporters()
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Could not send invite.')
    } finally {
      setInviting(false)
    }
  }

  async function revokeSupporter(id: string, name: string) {
    if (!window.confirm(`Remove ${name}'s access?`)) return
    try {
      await fetch(`/api/margaret/supporters/${id}`, { method: 'DELETE', ...FETCH_OPTS })
      fetchSupporters()
    } catch {
      showNotice('Could not remove access. Try again.', false)
    }
  }

  async function cancelInvite(id: string, email: string) {
    if (!window.confirm(`Cancel the invite to ${email}?`)) return
    try {
      await fetch(`/api/margaret/supporters/invites/${id}`, { method: 'DELETE', ...FETCH_OPTS })
      fetchSupporters()
    } catch {
      showNotice('Could not cancel invite. Try again.', false)
    }
  }

  function showNotice(msg: string, ok: boolean) {
    setNotice({ msg, ok })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  function friendlyOAuthError(code: string): string {
    switch (code) {
      case 'google_denied':       return 'Google sign-in was cancelled.'
      case 'google_state_invalid':return 'The sign-in link expired. Please try again.'
      case 'google_token_failed': return 'Google sign-in failed. Please try again.'
      default:                    return 'Something went wrong. Please try again.'
    }
  }

  // ── Google connect ─────────────────────────────────────────────────────────

  async function connectGoogle(service: 'gmail' | 'drive') {
    if (!user) return
    setBusy(b => ({ ...b, [service]: true }))
    try {
      const res = await fetch(`/api/connections/google/start?service=${service}`, {
        ...FETCH_OPTS,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Could not start Google sign-in')
      }
      const { url } = await res.json()
      window.location.href = url   // full-page redirect to Google consent screen
    } catch (e: unknown) {
      showNotice(e instanceof Error ? e.message : 'Google sign-in failed.', false)
      setBusy(b => ({ ...b, [service]: false }))
    }
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async function disconnect(provider: string) {
    if (!user) return
    setBusy(b => ({ ...b, [provider]: true }))
    try {
      await fetch(`/api/connections/${provider}`, {
        method: 'DELETE',
        ...FETCH_OPTS,
      })
      fetchStatus()
      if (provider === 'venmo')   setVenmoUsername('')
      if (provider === 'monarch') {
        setMonarchEmail(''); setMonarchPassword(''); setMonarchOtp('')
        setMonarchNeedsMfa(false); setMonarchConnectedEmail(''); setMonarchError('')
      }
      showNotice('Disconnected.', true)
    } catch {
      showNotice('Could not disconnect. Try again.', false)
    } finally {
      setBusy(b => ({ ...b, [provider]: false }))
    }
  }

  // ── Monarch Money connect ──────────────────────────────────────────────────

  async function connectMonarch() {
    if (!user || !monarchEmail.trim() || !monarchPassword) return
    setBusy(b => ({ ...b, monarch: true }))
    setMonarchError('')
    try {
      const body: Record<string, string> = {
        email:    monarchEmail.trim(),
        password: monarchPassword,
      }
      if (monarchOtp.trim()) body.totp_code = monarchOtp.trim()

      const res = await fetch('/api/connections/monarch/connect', {
        method:  'POST',
        headers: JSON_HEADERS,
        ...FETCH_OPTS,
        body:    JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: string = data.detail || 'Could not connect Monarch Money.'
        // If server says MFA is needed, reveal the OTP field
        if (msg.toLowerCase().includes('two-factor') || msg.toLowerCase().includes('mfa')) {
          setMonarchNeedsMfa(true)
        }
        setMonarchError(msg)
        return
      }
      // Success
      setMonarchEmail(''); setMonarchPassword(''); setMonarchOtp('')
      setMonarchNeedsMfa(false); setMonarchError('')
      fetchStatus()
      showNotice('Monarch Money connected!', true)
    } catch (e: unknown) {
      setMonarchError(e instanceof Error ? e.message : 'Monarch connection failed.')
    } finally {
      setBusy(b => ({ ...b, monarch: false }))
    }
  }

  // ── Venmo save ─────────────────────────────────────────────────────────────

  async function saveVenmo() {
    if (!user || !venmoUsername.trim()) return
    setVenmoSaving(true)
    try {
      const res = await fetch('/api/connections/venmo', {
        method: 'PUT',
        headers: JSON_HEADERS,
        ...FETCH_OPTS,
        body: JSON.stringify({ username: venmoUsername.trim() }),
      })
      if (!res.ok) throw new Error('Could not save Venmo username')
      fetchStatus()
      showNotice('Venmo username saved!', true)
    } catch (e: unknown) {
      showNotice(e instanceof Error ? e.message : 'Could not save.', false)
    } finally {
      setVenmoSaving(false)
    }
  }

  // ── Password email ─────────────────────────────────────────────────────────

  async function requestPasswordEmail() {
    if (!user) return
    setPwBusy(true); setPwNotice('')
    try {
      const res = await fetch('/api/auth/request-set-password', {
        method: 'POST',
        ...FETCH_OPTS,
      })
      if (!res.ok) throw new Error('Could not send email')
      setPwNotice('Check your email — a link to set your password is on its way.')
    } catch {
      setPwNotice('Could not send email. Try again.')
    } finally {
      setPwBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!user) return null

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
        gap: 0,
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          Settings
        </h1>
      </div>

      {/* ── Flash notice ── */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 16,
            padding: '14px 20px',
            borderRadius: 14,
            background: notice.ok ? '#1a3a1a' : '#3a1a1a',
            color: notice.ok ? '#7fe07f' : '#ff7f7f',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {notice.msg}
        </div>
      )}

      {/* ── Section: Connected services ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Connected services
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>

        {/* Gmail */}
        <ServiceCard
          icon="📧"
          label="Gmail"
          description="Read and summarize your emails."
          accentColor="#4285f4"
          connected={status?.gmail ?? false}
          busy={busy['gmail'] ?? false}
          onConnect={() => connectGoogle('gmail')}
          onDisconnect={() => disconnect('gmail')}
        />

        {/* Google Drive */}
        <ServiceCard
          icon="📁"
          label="Google Drive"
          description="Open and summarize documents from your Drive."
          accentColor="#34a853"
          connected={status?.drive ?? false}
          busy={busy['drive'] ?? false}
          onConnect={() => connectGoogle('drive')}
          onDisconnect={() => disconnect('drive')}
        />

        {/* Venmo */}
        <ServiceCard
          icon="💸"
          label="Venmo"
          description="Save your Venmo @username so warm.care can help you send and request money."
          accentColor="#3d95ce"
          connected={status?.venmo ?? false}
          busy={busy['venmo'] ?? false}
          onConnect={saveVenmo}
          onDisconnect={() => disconnect('venmo')}
        >
          {/* Username input — always shown for Venmo */}
          <div>
            <label
              htmlFor="venmo-username"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}
            >
              Your Venmo @username
            </label>
            <input
              id="venmo-username"
              type="text"
              value={venmoUsername}
              onChange={e => setVenmoUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveVenmo()}
              placeholder="@yourname"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '0 16px',
                minHeight: 56,
                fontSize: 18,
                background: 'var(--color-surface-raised)',
                border: '2px solid var(--color-border)',
                borderRadius: 12,
                color: 'var(--color-text)',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </ServiceCard>

        {/* Monarch Money */}
        <ServiceCard
          icon="👑"
          label="Monarch Money"
          description="Sync your transactions so Check Run can automatically match and clear your bills."
          accentColor="#00a804"
          connected={status?.monarch ?? false}
          busy={busy['monarch'] ?? false}
          onConnect={connectMonarch}
          onDisconnect={() => disconnect('monarch')}
          inlineError={monarchError}
        >
          {status?.monarch ? (
            /* Connected state — show email */
            <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-muted)' }}>
              Connected as <strong style={{ color: 'var(--color-text)' }}>{monarchConnectedEmail}</strong>
            </p>
          ) : (
            /* Disconnected state — credential inputs */
            <>
              {/* Email */}
              <div>
                <label
                  htmlFor="monarch-email"
                  style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}
                >
                  Monarch Money email
                </label>
                <input
                  id="monarch-email"
                  type="email"
                  autoComplete="email"
                  value={monarchEmail}
                  onChange={e => setMonarchEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '0 16px',
                    minHeight: 56,
                    fontSize: 18,
                    background: 'var(--color-surface-raised)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 12,
                    color: 'var(--color-text)',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="monarch-password"
                  style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="monarch-password"
                    type={monarchShowPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={monarchPassword}
                    onChange={e => setMonarchPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !monarchNeedsMfa) connectMonarch() }}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '0 56px 0 16px',
                      minHeight: 56,
                      fontSize: 18,
                      background: 'var(--color-surface-raised)',
                      border: '2px solid var(--color-border)',
                      borderRadius: 12,
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                  {/* Show/hide toggle — stylus users need to verify input */}
                  <button
                    type="button"
                    onClick={() => setMonarchShowPw(v => !v)}
                    aria-label={monarchShowPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      minHeight: 40,
                      minWidth: 40,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 18,
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {monarchShowPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* OTP field — shown only when server signals 2FA is required */}
              {monarchNeedsMfa && (
                <div>
                  <label
                    htmlFor="monarch-otp"
                    style={{ fontSize: 14, fontWeight: 600, color: '#f0a500', display: 'block', marginBottom: 6 }}
                  >
                    Two-factor code (6 digits from your authenticator app)
                  </label>
                  <input
                    id="monarch-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={monarchOtp}
                    onChange={e => setMonarchOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') connectMonarch() }}
                    placeholder="123456"
                    style={{
                      width: '100%',
                      padding: '0 16px',
                      minHeight: 56,
                      fontSize: 22,
                      letterSpacing: '0.2em',
                      background: 'var(--color-surface-raised)',
                      border: '2px solid #f0a500',
                      borderRadius: 12,
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </ServiceCard>

      </div>

      {/* ── Section: Appearance ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Appearance
      </h2>

      <div
        role="radiogroup"
        aria-label="Color theme"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}
      >
        {themes.map(theme => {
          const active = themeId === theme.id
          return (
            <button
              key={theme.id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(theme.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '16px 14px',
                borderRadius: 18,
                border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                background: active ? `${theme.preview.bg}` : 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 'auto',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Mini preview swatch */}
              <div
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 10,
                  background: theme.preview.bg,
                  border: `1px solid ${theme.preview.surface}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  gap: 6,
                  overflow: 'hidden',
                }}
              >
                {/* Text line previews */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ height: 5, borderRadius: 3, background: theme.preview.text, width: '70%' }} />
                  <div style={{ height: 4, borderRadius: 3, background: theme.preview.text, width: '50%', opacity: 0.5 }} />
                </div>
                {/* Accent dot */}
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: theme.preview.accent, flexShrink: 0 }} />
              </div>

              <div>
                <span style={{
                  display: 'block',
                  fontSize: 16,
                  fontWeight: 700,
                  color: active ? 'var(--color-accent)' : 'var(--color-text)',
                  lineHeight: 1.2,
                }}>
                  {theme.emoji} {theme.name}
                </span>
                <span style={{
                  display: 'block',
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                  marginTop: 2,
                }}>
                  {theme.description}
                </span>
              </div>

              {active && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  letterSpacing: '0.04em',
                }}>
                  ✓ Active
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Font size ── */}
      <h3 style={{ margin: '24px 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Text size
      </h3>
      <div
        role="radiogroup"
        aria-label="Text size"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}
      >
        {([
          { id: 'normal',  label: 'Standard', preview: 18 },
          { id: 'large',   label: 'Large',    preview: 22 },
          { id: 'xlarge',  label: 'X-Large',  preview: 28 },
        ] as const).map(opt => {
          const active = profile.fontSize === opt.id
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              onClick={() => setProfile({ ...profile, fontSize: opt.id })}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '14px 10px',
                borderRadius: 18,
                border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                background: active ? 'var(--color-surface-raised)' : 'var(--color-surface)',
                cursor: 'pointer',
                minHeight: 'auto',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: opt.preview, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                Aa
              </span>
              <span style={{ fontSize: 13, color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: active ? 700 : 400 }}>
                {opt.label}
              </span>
              {active && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)' }}>✓ Active</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Section: Supporters ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Supporters
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>

        {/* Invite message */}
        {inviteMsg && (
          <p role="status" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-confirm)' }}>{inviteMsg}</p>
        )}

        {/* Invite form */}
        {showInviteForm ? (
          <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 20, border: '2px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Add a supporter</h3>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)' }}>Their email address</span>
              <input
                type="email" inputMode="email" autoComplete="off"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ minHeight: 56, borderRadius: 12, border: '2px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 18, padding: '0 16px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)' }}>Their role</span>
              <select
                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                style={{ minHeight: 56, borderRadius: 12, border: '2px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 17, padding: '0 16px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }}
              >
                {SUPPORTER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>

            {inviteRole === 'respite' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)' }}>Access ends on</span>
                <input
                  type="date" value={inviteExpiry} onChange={e => setInviteExpiry(e.target.value)}
                  style={{ minHeight: 56, borderRadius: 12, border: '2px solid var(--color-border)', background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 18, padding: '0 16px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }}
                />
              </label>
            )}

            {inviteError && <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--color-danger)' }}>{inviteError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
                style={{ ...BTN, flex: 1, background: 'var(--color-accent)', color: '#fff', opacity: inviting || !inviteEmail.trim() ? 0.6 : 1 }}
              >
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
              <button
                onClick={() => { setShowInviteForm(false); setInviteError('') }}
                style={{ ...BTN, background: 'var(--color-surface-raised)', border: '2px solid var(--color-border)', color: 'var(--color-text)', padding: '0 20px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowInviteForm(true)}
            style={{ ...BTN, width: '100%', background: 'var(--color-accent)', color: '#fff', fontSize: 18 }}
          >
            + Add a supporter
          </button>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pending ({pendingInvites.length})
            </p>
            {pendingInvites.map(inv => (
              <div key={inv.id} style={{ background: 'var(--color-surface)', borderRadius: 14, border: '2px dashed var(--color-border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>{inv.email}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>{inv.role_label} · Invite pending</p>
                </div>
                <button
                  onClick={() => cancelInvite(inv.id, inv.email)}
                  aria-label={`Cancel invite to ${inv.email}`}
                  style={{ ...BTN, minHeight: 44, fontSize: 13, background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0 12px', flexShrink: 0 }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Supporter list */}
        {supportersLoading ? (
          <p style={{ margin: 0, fontSize: 16, color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : supporters.filter(s => !s.revoked).length === 0 && pendingInvites.length === 0 ? (
          <p style={{ margin: 0, fontSize: 16, color: 'var(--color-text-muted)' }}>No supporters yet. Add someone above.</p>
        ) : supporters.filter(s => !s.revoked).length === 0 ? null : (
          supporters.filter(s => !s.revoked).map(s => (
            <div key={s.id} style={{ background: 'var(--color-surface)', borderRadius: 16, border: '2px solid var(--color-border)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 72 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{s.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>{s.role_label} · {s.email}</p>
              </div>
              <button
                onClick={() => revokeSupporter(s.id, s.name)}
                aria-label={`Remove ${s.name}`}
                style={{ ...BTN, minHeight: 48, minWidth: 48, fontSize: 14, fontWeight: 700, background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 10, padding: '0 12px', flexShrink: 0 }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Section: Account ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Account
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>

        {/* Set / change password */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            Password
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--color-text-muted)' }}>
            Send a link to <strong>{user.email}</strong> to set or change your password.
          </p>
          {pwNotice && (
            <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--color-text-muted)' }}>
              {pwNotice}
            </p>
          )}
          <button
            onClick={requestPasswordEmail}
            disabled={pwBusy}
            aria-label="Send password setup link"
            style={{
              ...BTN,
              background: 'var(--color-surface-raised)',
              border: '2px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: 16,
              padding: '0 24px',
              opacity: pwBusy ? 0.5 : 1,
            }}
          >
            {pwBusy ? 'Sending…' : 'Send password link'}
          </button>
        </div>

      </div>

      {/* ── Sign out ── */}
      <button
        onClick={logout}
        aria-label="Sign out"
        style={{
          ...BTN,
          background: 'transparent',
          border: '2px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: 18,
          marginBottom: 32,
        }}
      >
        Sign out
      </button>

      <footer style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 8 }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
