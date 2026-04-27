/**
 * CheckRunView — dynamic monthly financial snapshot at /check-run
 *
 * All bill/income data comes from /api/checkrun/data, which is backed by
 * Monarch Money transaction data pushed via the local sync script.
 * Manual cleared overrides are stored server-side via /api/checkrun/toggle.
 */

import { useState, useEffect, useCallback } from 'react'
import { navigate } from '../App'

// ── API types ──────────────────────────────────────────────────────────────────

interface CheckRunItem {
  id: string
  section: string          // 'bills' | 'income'
  sort_order: number
  name: string
  description: string | null
  payment_method: string | null
  expected_amount: number | null
  due_day: number | null
  comment: string | null
  cleared: boolean
  cleared_source: 'manual' | 'transaction' | 'date' | 'pending'
  matched_amount: number | null
  matched_merchant: string | null
  matched_date: string | null
}

interface CheckRunData {
  year: number
  month: number
  last_sync: string | null
  items: CheckRunItem[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function formatAmount(amount: number | null): string {
  if (amount === null || amount === 0) return '—'
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDueDay(day: number | null): string {
  if (!day) return ''
  const s = ['th','st','nd','rd']
  const v = day % 100
  return day + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatLastSync(ts: string | null): string {
  if (!ts) return 'Never synced'
  try {
    const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'))
    return 'Synced ' + d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return 'Synced recently'
  }
}

// Source badge colors
const SOURCE_COLORS: Record<string, string> = {
  transaction: '#2a7a3b',
  date:        '#3a6bbf',
  manual:      '#7b6ef6',
  pending:     'var(--color-text-muted)',
}

const SOURCE_LABELS: Record<string, string> = {
  transaction: 'matched',
  date:        'by date',
  manual:      'manual',
  pending:     '',
}

// ── Row component ─────────────────────────────────────────────────────────────

interface RowProps {
  item: CheckRunItem
  onToggle: (id: string, cleared: boolean) => void
}

function CheckRow({ item, onToggle }: RowProps) {
  const { cleared, cleared_source } = item
  const rightParts = [
    item.due_day ? formatDueDay(item.due_day) : '',
    item.payment_method ?? '',
  ].filter(Boolean)

  const matchDetail = item.matched_merchant
    ? `${item.matched_merchant}${item.matched_date ? ' · ' + item.matched_date : ''}`
    : null

  return (
    <button
      onClick={() => onToggle(item.id, cleared)}
      aria-pressed={cleared}
      aria-label={`${item.name}${cleared ? ', cleared' : ', not cleared'} — tap to toggle`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 64,
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 0',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {/* Cleared indicator */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: cleared ? SOURCE_COLORS[cleared_source] : 'var(--color-surface-raised)',
          border: `2px solid ${cleared ? SOURCE_COLORS[cleared_source] : 'var(--color-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
          transition: 'background 0.15s, border 0.15s',
          color: '#fff',
        }}
      >
        {cleared ? '✓' : ''}
      </div>

      {/* Name + sublabel + match detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 17,
          fontWeight: cleared ? 400 : 600,
          color: cleared ? 'var(--color-text-muted)' : 'var(--color-text)',
          textDecoration: cleared ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        {(item.description || item.comment || matchDetail) && (
          <div style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {[item.description, item.comment, matchDetail].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Due day / payment method + source badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        {rightParts.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {rightParts.join(' · ')}
          </div>
        )}
        {cleared && SOURCE_LABELS[cleared_source] && (
          <div style={{
            fontSize: 11,
            color: SOURCE_COLORS[cleared_source],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {SOURCE_LABELS[cleared_source]}
          </div>
        )}
      </div>

      {/* Amount */}
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: cleared ? 'var(--color-text-muted)' : 'var(--color-text)',
        flexShrink: 0,
        minWidth: 60,
        textAlign: 'right',
      }}>
        {item.matched_amount !== null
          ? formatAmount(Math.abs(item.matched_amount))
          : formatAmount(item.expected_amount)}
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CheckRunView() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [data,    setData]    = useState<CheckRunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/checkrun/data?year=${y}&month=${m}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load check run')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData])

  async function toggle(id: string, currentCleared: boolean) {
    setToggling(id)
    // Optimistic update
    setData(prev => prev ? {
      ...prev,
      items: prev.items.map(item =>
        item.id === id
          ? { ...item, cleared: !currentCleared, cleared_source: 'manual' }
          : item
      ),
    } : prev)

    try {
      const res = await fetch('/api/checkrun/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bill_id: id, year, month, cleared: !currentCleared }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Re-fetch to get authoritative server state
      await fetchData(year, month)
    } catch {
      // Revert optimistic update on error
      setData(prev => prev ? {
        ...prev,
        items: prev.items.map(item =>
          item.id === id
            ? { ...item, cleared: currentCleared }
            : item
        ),
      } : prev)
    } finally {
      setToggling(null)
    }
  }

  function prevMonth() {
    const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1]
    setYear(y); setMonth(m)
  }
  function nextMonth() {
    const [y, m] = month === 12 ? [year + 1, 1] : [year, month + 1]
    setYear(y); setMonth(m)
  }

  const bills  = data?.items.filter(i => i.section === 'bills')  ?? []
  const income = data?.items.filter(i => i.section === 'income') ?? []
  const clearedBills  = bills.filter(i => i.cleared).length
  const clearedIncome = income.filter(i => i.cleared).length
  const totalBillsAmt = bills.reduce((sum, b) => sum + (b.expected_amount ?? 0), 0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: 'var(--color-bg)',
      maxWidth: 640,
      margin: '0 auto',
      padding: '16px',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/')}
          aria-label="Back to home"
          style={{
            minHeight: 64, minWidth: 64, borderRadius: 16, border: 'none',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            fontSize: 24, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >←</button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>
          Check Run
        </h1>
        <button
          onClick={() => fetchData(year, month)}
          aria-label="Refresh check run"
          disabled={loading}
          style={{
            minHeight: 48, minWidth: 48, borderRadius: 12, border: 'none',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            fontSize: 20, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
          }}
        >↻</button>
      </div>

      {/* ── Month navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-surface)', borderRadius: 16,
        padding: '12px 16px', marginBottom: 8,
        border: '2px solid var(--color-border)',
      }}>
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          style={{ minHeight: 48, minWidth: 48, border: 'none', background: 'none', color: 'var(--color-text)', fontSize: 22, cursor: 'pointer', fontFamily: 'inherit' }}
        >‹</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
            {MONTH_NAMES[month - 1]} {year}
          </div>
          {data && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {clearedBills}/{bills.length} bills · {clearedIncome}/{income.length} income
            </div>
          )}
        </div>

        <button
          onClick={nextMonth}
          aria-label="Next month"
          style={{ minHeight: 48, minWidth: 48, border: 'none', background: 'none', color: 'var(--color-text)', fontSize: 22, cursor: 'pointer', fontFamily: 'inherit' }}
        >›</button>
      </div>

      {/* ── Sync status bar ── */}
      <div style={{
        textAlign: 'center', fontSize: 12,
        color: 'var(--color-text-muted)', marginBottom: 16, paddingTop: 4,
      }}>
        {data ? formatLastSync(data.last_sync) : ''}
      </div>

      {/* ── Loading / error states ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      )}
      {!loading && error && (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 16, padding: '24px',
          textAlign: 'center', color: 'var(--color-text-muted)',
          border: '2px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 600 }}>Could not load data</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{error}</div>
          <button
            onClick={() => fetchData(year, month)}
            style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 12,
              border: 'none', background: 'var(--color-accent)',
              color: '#fff', fontFamily: 'inherit', fontSize: 15,
              fontWeight: 600, cursor: 'pointer', minHeight: 48,
            }}
          >Retry</button>
        </div>
      )}

      {/* ── Bills section ── */}
      {!loading && !error && data && bills.length > 0 && (
        <section aria-label="Monthly bills" style={{
          background: 'var(--color-surface)', borderRadius: 20,
          padding: '16px 20px', marginBottom: 16,
          border: '2px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Bills
            </h2>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Est. ${totalBillsAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {bills.map(item => (
            <div key={item.id} style={{ opacity: toggling === item.id ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <CheckRow item={item} onToggle={toggle} />
            </div>
          ))}
        </section>
      )}

      {/* ── Income section ── */}
      {!loading && !error && data && income.length > 0 && (
        <section aria-label="Income sources" style={{
          background: 'var(--color-surface)', borderRadius: 20,
          padding: '16px 20px', marginBottom: 24,
          border: '2px solid var(--color-border)',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Income Received
          </h2>

          {income.map(item => (
            <div key={item.id} style={{ opacity: toggling === item.id ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <CheckRow item={item} onToggle={toggle} />
            </div>
          ))}
        </section>
      )}

      {/* ── Empty state (no bills yet) ── */}
      {!loading && !error && data && bills.length === 0 && income.length === 0 && (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 20, padding: '40px 24px',
          textAlign: 'center', border: '2px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
            No bills synced yet
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            Run the Monarch Money sync script to populate your bill list and transaction data.
          </div>
        </div>
      )}

      <footer style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 8, marginTop: 'auto' }}>
        <p style={{ margin: 0 }}>Tap any row to mark it cleared or uncleared.</p>
        <p style={{ margin: '4px 0 0' }}>
          <span style={{ color: SOURCE_COLORS.transaction }}>● matched</span>
          {' · '}
          <span style={{ color: SOURCE_COLORS.date }}>● by date</span>
          {' · '}
          <span style={{ color: SOURCE_COLORS.manual }}>● manual</span>
        </p>
      </footer>
    </div>
  )
}
