/**
 * AdminPanel — /admin
 *
 * Access request queue for the admin user (ellengambrell@gmail.com).
 * Requires role='admin' from /api/auth/me — redirects non-admins to home.
 *
 * Routes:
 *   GET  /api/admin/requests
 *   GET  /api/admin/pending-count
 *   POST /api/admin/requests/{id}/approve
 *   POST /api/admin/requests/{id}/deny
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'

interface AccessRequest {
  id: string
  name: string
  email: string
  requested_at: number
  status: 'pending' | 'approved' | 'denied'
  reviewed_at: number | null
  reviewed_by: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '24px 16px 48px',
  } as React.CSSProperties,

  heading: {
    fontSize: 'var(--fs-2xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: '0 0 4px',
  } as React.CSSProperties,

  subheading: {
    fontSize: 'var(--fs-lg)',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: '32px 0 12px',
  } as React.CSSProperties,

  card: {
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: 18,
    padding: '20px',
    marginBottom: 12,
  } as React.CSSProperties,

  name: {
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: '0 0 2px',
  } as React.CSSProperties,

  meta: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--color-text-muted)',
    margin: '0 0 16px',
  } as React.CSSProperties,

  btnRow: {
    display: 'flex',
    gap: 10,
  } as React.CSSProperties,

  btn: (variant: 'approve' | 'deny' | 'disabled'): React.CSSProperties => ({
    flex: 1,
    minHeight: 64,
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
    borderRadius: 14,
    border: variant === 'deny' ? '2px solid var(--color-border)' : 'none',
    cursor: variant === 'disabled' ? 'default' : 'pointer',
    fontFamily: 'inherit',
    background:
      variant === 'approve' ? 'var(--color-accent)' :
                              'var(--color-surface-raised)',
    color:
      variant === 'approve' ? '#000' :
                              'var(--color-text-muted)',
    opacity: variant === 'disabled' ? 0.5 : 1,
  }),

  badge: {
    display: 'inline-block',
    background: 'var(--color-accent)',
    color: '#000',
    fontWeight: 700,
    fontSize: 'var(--fs-sm)',
    borderRadius: 99,
    padding: '2px 10px',
    marginLeft: 8,
    verticalAlign: 'middle',
  } as React.CSSProperties,

  statusTag: (status: string): React.CSSProperties => ({
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color:
      status === 'approved' ? '#2d7a3a' :
      status === 'denied'   ? 'var(--color-text-muted)' :
                              'var(--color-accent)',
    textTransform: 'capitalize' as const,
  }),

  empty: {
    color: 'var(--color-text-muted)',
    fontSize: 'var(--fs-base)',
    padding: '24px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onApprove,
  onDeny,
}: {
  req: AccessRequest
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function act(action: 'approve' | 'deny') {
    setBusy(true)
    try {
      if (action === 'approve') onApprove(req.id)
      else onDeny(req.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.card} role="article" aria-label={`Access request from ${req.name}`}>
      <p style={S.name}>{req.name}</p>
      <p style={S.meta}>
        {req.email} · requested {formatDate(req.requested_at)}
      </p>

      {req.status === 'pending' ? (
        <div style={S.btnRow}>
          <button
            style={S.btn(busy ? 'disabled' : 'approve')}
            onClick={() => act('approve')}
            disabled={busy}
            aria-label={`Approve access for ${req.name}`}
          >
            Approve
          </button>
          <button
            style={S.btn(busy ? 'disabled' : 'deny')}
            onClick={() => act('deny')}
            disabled={busy}
            aria-label={`Deny access for ${req.name}`}
          >
            Deny
          </button>
        </div>
      ) : (
        <p style={S.statusTag(req.status)}>
          {req.status}
          {req.reviewed_at ? ` · ${formatDate(req.reviewed_at)}` : ''}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Non-admins should not be here.
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/')
  }, [user])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/requests', { credentials: 'include' })
      if (!res.ok) throw new Error(`${res.status}`)
      setRequests(await res.json())
    } catch {
      setError('Could not load requests. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/requests/${id}/approve`, {
      method: 'POST', credentials: 'include',
    })
    if (res.ok) setRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'approved', reviewed_at: Date.now() / 1000 } : r)
    )
  }

  async function handleDeny(id: string) {
    const res = await fetch(`/api/admin/requests/${id}/deny`, {
      method: 'POST', credentials: 'include',
    })
    if (res.ok) setRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'denied', reviewed_at: Date.now() / 1000 } : r)
    )
  }

  if (user?.role !== 'admin') return null

  const pending  = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  return (
    <div style={S.page}>
      <h1 style={S.heading}>
        Admin
      </h1>
      <p style={{ color: 'var(--color-text-muted)', margin: '0 0 8px', fontSize: 'var(--fs-base)' }}>
        Access requests
      </p>

      {loading && (
        <p style={S.empty}>Loading…</p>
      )}
      {error && (
        <p role="alert" style={{ color: 'var(--color-error, #c0392b)', fontSize: 'var(--fs-base)' }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          <h2 style={S.subheading}>
            Pending
            {pending.length > 0 && (
              <span style={S.badge} aria-label={`${pending.length} pending`}>{pending.length}</span>
            )}
          </h2>

          {pending.length === 0 ? (
            <p style={S.empty}>No pending requests.</p>
          ) : (
            pending.map(r => (
              <RequestCard key={r.id} req={r} onApprove={handleApprove} onDeny={handleDeny} />
            ))
          )}

          {reviewed.length > 0 && (
            <>
              <h2 style={S.subheading}>Reviewed</h2>
              {reviewed.map(r => (
                <RequestCard key={r.id} req={r} onApprove={handleApprove} onDeny={handleDeny} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
