/**
 * BillsView — view and manage recurring bills.
 *
 * Two sections (no tabs — flat for sip-and-puff):
 *   1. My Bills — list of stored bill records
 *   2. Recent Bills — Gmail matches (only if Gmail connected + at least one sender_email set)
 */

import { useState, useEffect, useCallback } from 'react'
import { navigate } from '../App'
import { useTrackVisit } from '../hooks/useTrackVisit'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bill {
  id: string
  category: string
  company_name: string
  phone_number: string | null
  customer_number: string | null
  sender_email: string | null
  last_bill_seen_at: string | null
  created_at: string
  updated_at: string
}

interface RecentMessage {
  id: string
  threadId: string
  subject: string
  date: string
  from: string
}

interface CheckResult {
  bill_id: string
  company_name: string
  new_count: number
  recent_messages: RecentMessage[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'electric',  label: 'Electric' },
  { value: 'gas',       label: 'Gas' },
  { value: 'water',     label: 'Water' },
  { value: 'phone',     label: 'Phone' },
  { value: 'internet',  label: 'Internet' },
  { value: 'other',     label: 'Other' },
]

const CATEGORY_ICONS: Record<string, string> = {
  electric: '⚡',
  gas:      '🔥',
  water:    '💧',
  phone:    '📱',
  internet: '🌐',
  other:    '🧾',
}

const BILL_COLOR = '#5c8fc2'

const BTN: React.CSSProperties = {
  minHeight: 64,
  borderRadius: 16,
  border: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 'var(--fs-md)',
  cursor: 'pointer',
}

const INPUT: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 12,
  border: '2px solid var(--color-border)',
  background: 'var(--color-surface-raised)',
  color: 'var(--color-text)',
  fontSize: 17,
  padding: '0 16px',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const FETCH_OPTS = { credentials: 'include' as RequestCredentials }
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Empty bill form state ─────────────────────────────────────────────────────

function emptyForm() {
  return {
    category: 'other',
    company_name: '',
    phone_number: '',
    customer_number: '',
    sender_email: '',
  }
}

// ── Bill Form (add / edit) ────────────────────────────────────────────────────

interface BillFormProps {
  initial?: Partial<ReturnType<typeof emptyForm>>
  onSave: (data: ReturnType<typeof emptyForm>) => Promise<void>
  onCancel: () => void
  saving: boolean
  error: string
  heading: string
}

function BillForm({ initial, onSave, onCancel, saving, error, heading }: BillFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 20,
        padding: '20px 20px 24px',
        border: '2px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
        {heading}
      </h2>

      {/* Category */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Category
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(cat => (
            <label
              key={cat.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 12,
                border: `2px solid ${form.category === cat.value ? BILL_COLOR : 'var(--color-border)'}`,
                background: form.category === cat.value ? 'var(--color-surface-raised)' : 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: form.category === cat.value ? 'var(--color-text)' : 'var(--color-text-muted)',
                minHeight: 44,
              }}
            >
              <input
                type="radio"
                name="category"
                value={cat.value}
                checked={form.category === cat.value}
                onChange={() => set('category', cat.value)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              <span aria-hidden="true">{CATEGORY_ICONS[cat.value]}</span>
              {cat.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Company name */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Company name <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
        </span>
        <input
          type="text"
          value={form.company_name}
          onChange={e => set('company_name', e.target.value)}
          placeholder="ConEd, AT&T, Spectrum…"
          autoCapitalize="words"
          style={INPUT}
          aria-required="true"
        />
      </label>

      {/* Phone number */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Phone number
        </span>
        <input
          type="tel"
          value={form.phone_number}
          onChange={e => set('phone_number', e.target.value)}
          placeholder="1-800-555-0100"
          style={INPUT}
        />
      </label>

      {/* Customer number */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Customer number
        </span>
        <input
          type="text"
          value={form.customer_number}
          onChange={e => set('customer_number', e.target.value)}
          placeholder="Account or customer ID"
          style={INPUT}
        />
      </label>

      {/* Sender email */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Bill sender email
        </span>
        <input
          type="email"
          value={form.sender_email}
          onChange={e => set('sender_email', e.target.value)}
          placeholder="billing@company.com"
          autoCapitalize="none"
          style={INPUT}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Add this to detect new bills in Gmail.
        </span>
      </label>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--color-danger)' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.company_name.trim()}
          style={{
            ...BTN,
            flex: 1,
            background: 'var(--color-accent)',
            color: '#fff',
            opacity: saving || !form.company_name.trim() ? 0.6 : 1,
          }}
          aria-label="Save bill"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          style={{
            ...BTN,
            background: 'var(--color-surface-raised)',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text)',
            padding: '0 20px',
          }}
          aria-label="Cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Bill card ─────────────────────────────────────────────────────────────────

interface BillCardProps {
  bill: Bill
  newCount: number
  onEdit: (bill: Bill) => void
  onDelete: (bill: Bill) => void
}

function BillCard({ bill, newCount, onEdit, onDelete }: BillCardProps) {
  const [copied, setCopied] = useState(false)

  async function copyCustomerNumber() {
    if (!bill.customer_number) return
    try {
      await navigator.clipboard.writeText(bill.customer_number)
      setCopied(true)
    } catch {
      // Clipboard API may be unavailable — silent fail
    }
  }

  const icon = CATEGORY_ICONS[bill.category] ?? '🧾'

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${newCount > 0 ? BILL_COLOR : 'var(--color-border)'}`,
        borderRadius: 20,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }} role="img" aria-hidden="true">{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--fs-md)',
              fontWeight: 700,
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {bill.company_name}
            {newCount > 0 && (
              <span
                aria-label={`New bill from ${bill.company_name}`}
                style={{
                  background: BILL_COLOR,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: '2px 10px',
                  lineHeight: 1.6,
                }}
              >
                New
              </span>
            )}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
            {bill.category}
          </p>
        </div>
      </div>

      {/* Phone number */}
      {bill.phone_number && (
        <a
          href={`tel:${bill.phone_number.replace(/\s/g, '')}`}
          aria-label={`Call ${bill.company_name}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 64,
            padding: '0 16px',
            borderRadius: 14,
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <span aria-hidden="true">📞</span>
          {bill.phone_number}
        </a>
      )}

      {/* Customer number */}
      {bill.customer_number && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 14,
            background: 'var(--color-surface-raised)',
            border: '2px solid var(--color-border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Customer number
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-base)', color: 'var(--color-text)', fontFamily: 'monospace' }}>
              {bill.customer_number}
            </p>
          </div>
          <button
            onClick={copyCustomerNumber}
            aria-label={`Copy customer number for ${bill.company_name}`}
            style={{
              ...BTN,
              minWidth: 80,
              background: copied ? 'var(--color-surface)' : 'var(--color-surface-raised)',
              border: `2px solid ${copied ? BILL_COLOR : 'var(--color-border)'}`,
              color: copied ? BILL_COLOR : 'var(--color-text-muted)',
              fontSize: 'var(--fs-sm)',
              padding: '0 14px',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => onEdit(bill)}
          aria-label={`Edit ${bill.company_name}`}
          style={{
            ...BTN,
            flex: 1,
            background: 'var(--color-surface-raised)',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(bill)}
          aria-label={`Delete ${bill.company_name}`}
          style={{
            ...BTN,
            minWidth: 64,
            background: 'transparent',
            color: 'var(--color-danger)',
            fontSize: 22,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface BillsViewProps {
  onOpen?: () => void  // called on mount so Home can clear the badge
}

export default function BillsView({ onOpen }: BillsViewProps) {
  useTrackVisit('bills')

  const [bills, setBills]           = useState<Bill[]>([])
  const [checkResults, setCheck]    = useState<CheckResult[]>([])
  const [gmailConnected, setGmail]  = useState(false)
  const [loading, setLoading]       = useState(true)

  // Form state
  const [showAdd, setShowAdd]       = useState(false)
  const [editBill, setEditBill]     = useState<Bill | null>(null)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  // Notify Home badge was seen
  useEffect(() => {
    onOpen?.()
  }, [onOpen])

  const loadBills = useCallback(async () => {
    try {
      const r = await fetch('/api/bills', FETCH_OPTS)
      if (r.ok) setBills(await r.json())
    } catch { /* silent */ }
  }, [])

  const checkGmail = useCallback(async () => {
    try {
      // Check connection status first
      const statusR = await fetch('/api/connections/status', FETCH_OPTS)
      if (statusR.ok) {
        const status = await statusR.json()
        setGmail(!!status.gmail)
        if (status.gmail) {
          const checkR = await fetch('/api/bills/check', FETCH_OPTS)
          if (checkR.ok) setCheck(await checkR.json())
        }
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    Promise.all([loadBills(), checkGmail()]).finally(() => setLoading(false))
  }, [loadBills, checkGmail])

  async function handleAdd(form: ReturnType<typeof emptyForm>) {
    setSaving(true); setFormError('')
    try {
      const r = await fetch('/api/bills', {
        method: 'POST',
        headers: JSON_HEADERS,
        ...FETCH_OPTS,
        body: JSON.stringify({
          category:        form.category,
          company_name:    form.company_name.trim(),
          phone_number:    form.phone_number.trim() || null,
          customer_number: form.customer_number.trim() || null,
          sender_email:    form.sender_email.trim() || null,
        }),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.detail || 'Could not save bill.')
      }
      setShowAdd(false)
      await loadBills()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(form: ReturnType<typeof emptyForm>) {
    if (!editBill) return
    setSaving(true); setFormError('')
    try {
      const r = await fetch(`/api/bills/${editBill.id}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        ...FETCH_OPTS,
        body: JSON.stringify({
          category:        form.category,
          company_name:    form.company_name.trim(),
          phone_number:    form.phone_number.trim() || null,
          customer_number: form.customer_number.trim() || null,
          sender_email:    form.sender_email.trim() || null,
        }),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.detail || 'Could not update bill.')
      }
      setEditBill(null)
      await loadBills()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not update.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bill: Bill) {
    if (!window.confirm(`Delete ${bill.company_name}?`)) return
    await fetch(`/api/bills/${bill.id}`, { method: 'DELETE', ...FETCH_OPTS })
    await loadBills()
  }

  function newCountFor(billId: string): number {
    return checkResults.find(r => r.bill_id === billId)?.new_count ?? 0
  }

  const hasSenderEmails = bills.some(b => b.sender_email)
  const showRecentSection = gmailConnected && hasSenderEmails

  // Flatten recent messages, annotated with company name
  const recentMessages: (RecentMessage & { company_name: string })[] = checkResults.flatMap(cr =>
    cr.recent_messages.map(m => ({ ...m, company_name: cr.company_name }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-base)' }}>Loading bills…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>
        Bills
      </h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
        Your accounts and contact info, in one place.
      </p>

      {/* ── My Bills ────────────────────────────────────────────────────────── */}
      <section aria-label="My Bills">
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 14px' }}>
          My Bills
        </h2>

        {bills.length === 0 && !showAdd && (
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)', marginBottom: 20 }}>
            No bills added yet.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {bills.map(bill => (
            editBill?.id === bill.id ? (
              <BillForm
                key={bill.id}
                heading={`Edit ${bill.company_name}`}
                initial={{
                  category:        bill.category,
                  company_name:    bill.company_name,
                  phone_number:    bill.phone_number ?? '',
                  customer_number: bill.customer_number ?? '',
                  sender_email:    bill.sender_email ?? '',
                }}
                onSave={handleEdit}
                onCancel={() => { setEditBill(null); setFormError('') }}
                saving={saving}
                error={formError}
              />
            ) : (
              <BillCard
                key={bill.id}
                bill={bill}
                newCount={newCountFor(bill.id)}
                onEdit={b => { setEditBill(b); setShowAdd(false); setFormError('') }}
                onDelete={handleDelete}
              />
            )
          ))}
        </div>

        {showAdd ? (
          <BillForm
            heading="Add a bill"
            onSave={handleAdd}
            onCancel={() => { setShowAdd(false); setFormError('') }}
            saving={saving}
            error={formError}
          />
        ) : !editBill && (
          <button
            onClick={() => setShowAdd(true)}
            aria-label="Add a bill"
            style={{
              ...BTN,
              width: '100%',
              background: 'var(--color-accent)',
              color: '#fff',
              marginBottom: 8,
            }}
          >
            + Add a bill
          </button>
        )}
      </section>

      {/* ── Recent Bills ─────────────────────────────────────────────────────── */}
      {showRecentSection && (
        <section aria-label="Recent Bills" style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 14px' }}>
            Recent Bills
          </h2>

          {recentMessages.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)' }}>
              No recent bill emails found.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentMessages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => navigate(`/gmail?message=${msg.id}`)}
                  aria-label={`Email from ${msg.company_name}: ${msg.subject || '(no subject)'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minHeight: 64,
                    padding: '12px 16px',
                    borderRadius: 16,
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    color: 'var(--color-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{msg.company_name}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.subject || '(no subject)'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{msg.date}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Gmail not connected but has sender emails configured */}
      {!gmailConnected && hasSenderEmails && (
        <div
          style={{
            marginTop: 36,
            background: 'var(--color-surface)',
            borderRadius: 16,
            padding: '16px 20px',
            border: '2px solid var(--color-border)',
          }}
        >
          <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--color-text-muted)' }}>
            Connect Gmail in Settings to see recent bills.{' '}
            <button
              onClick={() => navigate('/settings')}
              aria-label="Go to Settings to connect Gmail"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'var(--fs-base)',
                fontWeight: 600,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Open Settings
            </button>
          </p>
        </div>
      )}

      <footer style={{ textAlign: 'center', padding: '32px 0 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
