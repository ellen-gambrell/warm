/**
 * AdminPortal — three-tab admin UI at /admin
 *
 * Tab 1: Requests — review and approve/reject pending access requests
 * Tab 2: Users    — list of registered users (read-only)
 * Tab 3: Usage    — metrics summary (message counts, top features)
 *
 * Access is gated server-side. Non-admin users get a 403 and see "Access denied."
 */

import { useState, useEffect } from 'react'
import { NAVBAR_HEIGHT } from './NavBar'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccessRequest {
  id: string
  name: string
  email: string
  message: string
  status: 'pending' | 'approved' | 'denied'
  requested_at: number
  reviewed_at: number | null
}

interface User {
  id: string
  name: string
  email: string
  created_at: string
}

interface DailyCount {
  date: string
  count: number
}

interface FeatureCount {
  feature: string
  total_visits: number
}

interface Stats {
  total_users: number
  pending_requests: number
  messages_today: number
  total_messages_30d: number
  daily_messages: DailyCount[]
  top_features: FeatureCount[]
}

type Tab = 'requests' | 'users' | 'usage'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatIso(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  page: {
    padding: `${NAVBAR_HEIGHT + 24}px 1.5rem 2rem`,
    maxWidth: 800,
    margin: '0 auto',
  } as React.CSSProperties,
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 1.5rem',
    color: 'var(--color-text)',
  } as React.CSSProperties,
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '0.6rem 1.2rem',
    fontSize: '1rem',
    fontWeight: active ? 700 : 500,
    borderRadius: 12,
    border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
    background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
    color: active ? '#fff' : 'var(--color-text)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: 44,
  }),
  card: {
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: 16,
    padding: '1.25rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  value: {
    fontSize: '1rem',
    color: 'var(--color-text)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap' as const,
  },
  approveBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    background: 'var(--color-accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    minHeight: 44,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  rejectBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    background: 'var(--color-surface-raised)',
    color: 'var(--color-danger, #c0392b)',
    border: '2px solid var(--color-danger, #c0392b)',
    borderRadius: 10,
    cursor: 'pointer',
    minHeight: 44,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  badge: (status: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 8,
    fontSize: '0.8rem',
    fontWeight: 600,
    background: status === 'approved'
      ? 'var(--color-accent)'
      : status === 'denied'
        ? 'var(--color-danger, #c0392b)'
        : 'var(--color-surface-raised)',
    color: status === 'pending' ? 'var(--color-text-muted)' : '#fff',
  }),
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  statCard: {
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: 14,
    padding: '1rem',
    textAlign: 'center' as const,
  },
  statNum: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--color-accent)',
    display: 'block',
  } as React.CSSProperties,
  statLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    display: 'block',
    marginTop: 4,
  } as React.CSSProperties,
  featureBar: (pct: number): React.CSSProperties => ({
    height: 8,
    borderRadius: 4,
    background: 'var(--color-accent)',
    width: `${pct}%`,
    minWidth: 4,
    marginTop: 4,
  }),
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
    textAlign: 'center' as const,
    padding: '2rem 0',
  } as React.CSSProperties,
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPortal() {
  const [tab, setTab]               = useState<Tab>('requests')
  const [requests, setRequests]     = useState<AccessRequest[]>([])
  const [users, setUsers]           = useState<User[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [forbidden, setForbidden]   = useState(false)
  const [actionMsg, setActionMsg]   = useState<Record<string, string>>({})

  // Fetch data for the active tab
  useEffect(() => {
    setLoading(true)
    const url =
      tab === 'requests' ? '/api/admin/requests'
      : tab === 'users'  ? '/api/admin/users'
      :                    '/api/admin/stats'

    fetch(url, { credentials: 'include' })
      .then(res => {
        if (res.status === 403) { setForbidden(true); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (tab === 'requests') setRequests(data)
        else if (tab === 'users') setUsers(data)
        else setStats(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  async function doAction(reqId: string, action: 'approve' | 'deny') {
    const res = await fetch(`/api/admin/requests/${reqId}/${action}`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      setRequests(prev =>
        prev.map(r => r.id === reqId ? { ...r, status: action === 'approve' ? 'approved' : 'denied' } : r)
      )
      setActionMsg(prev => ({ ...prev, [reqId]: action === 'approve' ? 'Approved' : 'Denied' }))
    }
  }

  if (forbidden) {
    return (
      <div style={S.page}>
        <p style={S.muted}>Access denied.</p>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <h1 style={S.heading}>Admin</h1>

      {/* ── Tabs ── */}
      <div style={S.tabs}>
        {(['requests', 'users', 'usage'] as Tab[]).map(t => (
          <button
            key={t}
            style={S.tab(tab === t)}
            onClick={() => setTab(t)}
            aria-label={`${t} tab`}
          >
            {t === 'requests' ? 'Requests' : t === 'users' ? 'Users' : 'Usage'}
          </button>
        ))}
      </div>

      {loading && <p style={S.muted}>Loading…</p>}

      {/* ── Requests tab ── */}
      {!loading && tab === 'requests' && (
        <>
          {requests.length === 0 && <p style={S.muted}>No requests.</p>}
          {requests.map(r => (
            <div key={r.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>{r.name}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>{r.email}</div>
                </div>
                <span style={S.badge(r.status)}>{r.status}</span>
              </div>
              {r.message && (
                <div style={{ marginTop: 8, fontSize: '0.95rem', color: 'var(--color-text)', fontStyle: 'italic' }}>
                  "{r.message}"
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Requested {formatDate(r.requested_at)}
                {r.reviewed_at ? ` · Reviewed ${formatDate(r.reviewed_at)}` : ''}
              </div>
              {r.status === 'pending' && (
                <div style={S.actions}>
                  {actionMsg[r.id] ? (
                    <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                      {actionMsg[r.id]}
                    </span>
                  ) : (
                    <>
                      <button
                        style={S.approveBtn}
                        onClick={() => doAction(r.id, 'approve')}
                        aria-label={`Approve request from ${r.name}`}
                      >
                        Approve
                      </button>
                      <button
                        style={S.rejectBtn}
                        onClick={() => doAction(r.id, 'deny')}
                        aria-label={`Deny request from ${r.name}`}
                      >
                        Deny
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── Users tab ── */}
      {!loading && tab === 'users' && (
        <>
          {users.length === 0 && <p style={S.muted}>No users.</p>}
          {users.map(u => (
            <div key={u.id} style={S.card}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)' }}>{u.name}</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{u.email}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Joined {formatIso(u.created_at)}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Usage tab ── */}
      {!loading && tab === 'usage' && stats && (
        <>
          <div style={S.statGrid}>
            <div style={S.statCard}>
              <span style={S.statNum}>{stats.total_users}</span>
              <span style={S.statLabel}>Users</span>
            </div>
            <div style={S.statCard}>
              <span style={S.statNum}>{stats.pending_requests}</span>
              <span style={S.statLabel}>Pending requests</span>
            </div>
            <div style={S.statCard}>
              <span style={S.statNum}>{stats.messages_today}</span>
              <span style={S.statLabel}>Messages today</span>
            </div>
            <div style={S.statCard}>
              <span style={S.statNum}>{stats.total_messages_30d}</span>
              <span style={S.statLabel}>Messages (30 days)</span>
            </div>
          </div>

          {stats.top_features.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>Top features</div>
              {(() => {
                const max = stats.top_features[0]?.total_visits || 1
                return stats.top_features.map(f => (
                  <div key={f.feature} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--color-text)' }}>{f.feature}</span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>{f.total_visits}</span>
                    </div>
                    <div style={S.featureBar(Math.round((f.total_visits / max) * 100))} />
                  </div>
                ))
              })()}
            </div>
          )}

          {stats.daily_messages.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>Daily messages (30 days)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflowX: 'auto' }}>
                {(() => {
                  const maxCount = Math.max(...stats.daily_messages.map(d => d.count), 1)
                  return stats.daily_messages.map(d => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      style={{
                        flex: '1 0 6px',
                        minWidth: 6,
                        maxWidth: 20,
                        height: `${Math.max(4, Math.round((d.count / maxCount) * 80))}px`,
                        background: 'var(--color-accent)',
                        borderRadius: '2px 2px 0 0',
                        opacity: 0.85,
                      }}
                    />
                  ))
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
