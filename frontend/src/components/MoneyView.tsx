import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'
import { useTrackVisit } from '../hooks/useTrackVisit'

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

export default function MoneyView() {
  useTrackVisit('money')
  const { user } = useAuth()
  const [venmoUsername, setVenmoUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/connections/status', { credentials: 'include' })
        if (!res.ok) return
        const status = await res.json()
        if (status.venmo) {
          const vRes = await fetch('/api/connections/venmo', { credentials: 'include' })
          if (vRes.ok) {
            const vData = await vRes.json()
            setVenmoUsername(vData.username || null)
          }
        }
      } catch {
        // silently ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user])

  const isValid = recipient.trim() !== '' && amount.trim() !== '' && parseFloat(amount) > 0

  const openVenmo = (txn: 'pay' | 'charge') => {
    const r = recipient.replace(/^@/, '')
    const a = parseFloat(amount).toFixed(2)
    const n = note.trim()
    const params = new URLSearchParams({ txn, recipients: r, amount: a })
    if (n) params.set('note', n)
    window.location.href = `venmo://paycharge?${params.toString()}`
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
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          Venmo
        </h1>
      </div>

      {isLoading ? null : (
        <>
          {/* ── Venmo connected card ── */}
          {venmoUsername && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 20,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 28 }} role="img" aria-hidden="true">💙</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  VENMO CONNECTED
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                  {venmoUsername}
                </p>
              </div>
            </div>
          )}

          {/* ── Not connected ── */}
          {!venmoUsername && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 20,
                padding: 24,
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Connect your Venmo username in Settings to use quick pay.
              </p>
              <button
                onClick={() => navigate('/settings')}
                style={{
                  ...BTN,
                  background: 'var(--color-accent)',
                  color: '#fff',
                  padding: '0 24px',
                  minWidth: 0,
                }}
              >
                Go to Settings
              </button>
            </div>
          )}

          {/* ── Pay / Request card ── */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 20,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
              Pay or Request
            </h2>

            <div>
              <label
                htmlFor="venmo-recipient"
                style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Recipient @username
              </label>
              <input
                id="venmo-recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="@username"
                style={INPUT}
              />
            </div>

            <div>
              <label
                htmlFor="venmo-amount"
                style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Amount ($)
              </label>
              <input
                id="venmo-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                style={INPUT}
              />
            </div>

            <div>
              <label
                htmlFor="venmo-note"
                style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Note
              </label>
              <input
                id="venmo-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. dinner, rent"
                style={INPUT}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => openVenmo('charge')}
                disabled={!isValid}
                aria-label="Request money via Venmo"
                style={{
                  ...BTN,
                  flex: 1,
                  background: 'var(--color-accent)',
                  color: '#fff',
                  opacity: isValid ? 1 : 0.5,
                }}
              >
                Request
              </button>
              <button
                onClick={() => openVenmo('pay')}
                disabled={!isValid}
                aria-label="Pay via Venmo"
                style={{
                  ...BTN,
                  flex: 1,
                  background: '#34a853',
                  color: '#fff',
                  opacity: isValid ? 1 : 0.5,
                }}
              >
                Pay
              </button>
            </div>

            {recipient.trim() && (
              <a
                href={`https://venmo.com/${recipient.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 16,
                  color: 'var(--color-accent)',
                  padding: '8px 0',
                }}
              >
                Open Venmo on web ↗
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
