/**
 * SupporterManagement — key_contact view for managing the supporter list.
 * Shows all accounts, lets key_contact invite new supporters and revoke access.
 */

import { useState, useEffect, useCallback } from 'react'

interface SupporterAccount {
  id: string
  name: string
  email: string
  role: string
  role_label: string
  expires_at: number | null
  last_active_at: number | null
  revoked: boolean
}

const ROLES = [
  { value: 'key_contact',       label: 'Key Contact' },
  { value: 'sdm_supporter',     label: 'SDM Supporter' },
  { value: 'family_secondary',  label: 'Family' },
  { value: 'homemaker',         label: 'Homemaker' },
  { value: 'pca',               label: 'Personal Care Attendant' },
  { value: 'home_health_aide',  label: 'Home Health Aide' },
  { value: 'respite',           label: 'Respite (time-limited)' },
  { value: 'nurse_medical',     label: 'Nurse' },
  { value: 'therapist',         label: 'Therapist' },
  { value: 'case_manager',      label: 'Case Manager' },
  { value: 'financial_manager', label: 'Financial Manager' },
  { value: 'transportation',    label: 'Transportation' },
]

const BTN: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 14,
  border: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 17,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  padding: '0 20px',
}

const INPUT: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 14,
  border: '2px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 18,
  padding: '0 16px',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

function formatTime(ts: number | null): string {
  if (!ts) return 'Never'
  return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SupporterManagement() {
  const [accounts, setAccounts] = useState<SupporterAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('family_secondary')
  const [inviteExpiry, setInviteExpiry] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch('/api/supporter/accounts', { credentials: 'include' })
      if (!r.ok) throw new Error()
      const data = await r.json()
      setAccounts(data.supporters)
    } catch {
      setError('Could not load supporter accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const revoke = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s access? This takes effect immediately.`)) return
    try {
      const r = await fetch(`/api/supporter/accounts/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) throw new Error()
      await fetchAccounts()
    } catch {
      alert('Could not revoke access. Please try again.')
    }
  }

  const sendInvite = async () => {
    setInviteError('')
    setInviteMsg('')
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (inviteRole === 'respite' && !inviteExpiry) {
      setInviteError('Respite role requires an expiry date.')
      return
    }
    setInviting(true)
    try {
      const body: Record<string, unknown> = { email, role: inviteRole }
      if (inviteExpiry) body.expires_at = Math.floor(new Date(inviteExpiry).getTime() / 1000)
      const r = await fetch('/api/supporter/accounts/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.detail || 'Could not send invite.')
      }
      setInviteMsg(`Invite sent to ${email} ✓`)
      setInviteEmail('')
      setInviteRole('family_secondary')
      setInviteExpiry('')
      setShowInvite(false)
      await fetchAccounts()
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Could not send invite.')
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <p style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>Loading…</p>
  if (error) return <p style={{ fontSize: 20, color: 'var(--color-danger)' }}>{error}</p>

  const active = accounts.filter(a => !a.revoked)
  const revoked = accounts.filter(a => a.revoked)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Invite form toggle */}
      {inviteMsg && (
        <p role="status" style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-success, #2d8a4e)', margin: 0 }}>
          {inviteMsg}
        </p>
      )}

      {!showInvite ? (
        <button
          onClick={() => setShowInvite(true)}
          style={{ ...BTN, background: 'var(--color-accent)', color: '#fff', minHeight: 64, fontSize: 20 }}
        >
          + Invite someone
        </button>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 24, border: '2px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Send invite</h3>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Their email</span>
            <input style={INPUT} type="email" placeholder="email@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} inputMode="email" />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Role</span>
            <select
              style={{ ...INPUT, appearance: 'none' }}
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          {inviteRole === 'respite' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Access expires on</span>
              <input style={INPUT} type="date" value={inviteExpiry} onChange={e => setInviteExpiry(e.target.value)} />
            </label>
          )}

          {inviteError && (
            <p role="alert" style={{ margin: 0, fontSize: 17, color: 'var(--color-danger)' }}>{inviteError}</p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={{ ...BTN, flex: 1, background: 'var(--color-accent)', color: '#fff', opacity: inviting || !inviteEmail.trim() ? 0.6 : 1 }}
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteError('') }}
              style={{ ...BTN, background: 'var(--color-surface)', color: 'var(--color-text)', border: '2px solid var(--color-border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active supporters */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Active ({active.length})
        </h3>
        {active.length === 0 ? (
          <p style={{ fontSize: 18, color: 'var(--color-text-muted)' }}>No active supporters yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map(a => (
              <div
                key={a.id}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 16,
                  border: '2px solid var(--color-border)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  minHeight: 72,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>{a.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, color: 'var(--color-text-muted)' }}>
                    {a.role_label} · {a.email}
                  </p>
                  {a.expires_at && (
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-accent)' }}>
                      Expires {formatTime(a.expires_at)}
                    </p>
                  )}
                  <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
                    Last active: {formatTime(a.last_active_at)}
                  </p>
                </div>
                <button
                  onClick={() => revoke(a.id, a.name)}
                  aria-label={`Revoke ${a.name}'s access`}
                  style={{ ...BTN, minHeight: 48, fontSize: 15, background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', flexShrink: 0 }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked (collapsed) */}
      {revoked.length > 0 && (
        <details>
          <summary style={{ fontSize: 16, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            Revoked accounts ({revoked.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {revoked.map(a => (
              <div
                key={a.id}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 14,
                  border: '2px solid var(--color-border)',
                  padding: '12px 16px',
                  opacity: 0.6,
                }}
              >
                <p style={{ margin: 0, fontSize: 17, color: 'var(--color-text)' }}>{a.name} — {a.role_label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>{a.email}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
