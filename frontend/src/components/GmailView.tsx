import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'

interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string
  snippet: string
  unread: boolean
}

interface GmailFullMessage extends GmailMessage {
  to: string
  body: string
}

interface Synopsis {
  synopsis: string
  subject: string
  from: string
}

const BTN: React.CSSProperties = {
  minHeight: 64,
  borderRadius: 16,
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 18,
  transition: 'opacity 0.15s',
}

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: '0 0 12px' }}>{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong style={{ fontWeight: 700 }}>{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ margin: '0 0 12px', paddingLeft: 28, listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ margin: '0 0 12px', paddingLeft: 28, listStyleType: 'decimal' }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ marginBottom: 6, display: 'list-item' }}>{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--color-accent)', textDecorationSkipInk: 'auto' }}
    >
      {children}
    </a>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{children}</h3>
  ),
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function senderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.replace(/<.*>/, '').trim() || from
}

// ── Email viewer (full-screen) ────────────────────────────────────────────────

interface EmailViewerProps {
  messageId: string
  onBack: () => void
}

function EmailViewer({ messageId, onBack }: EmailViewerProps) {
  const [message, setMessage] = useState<GmailFullMessage | null>(null)
  const [msgLoading, setMsgLoading] = useState(true)
  const [msgError, setMsgError] = useState<string | null>(null)

  const [synopsis, setSynopsis] = useState<Synopsis | null>(null)
  const [synopsisLoading, setSynopsisLoading] = useState(true)
  const [synopsisError, setSynopsisError] = useState<string | null>(null)

  const [showFullEmail, setShowFullEmail] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadMessage() {
      setMsgLoading(true)
      setMsgError(null)
      try {
        const res = await fetch(`/api/gmail/messages/${messageId}`, { credentials: 'include' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Could not load email')
        }
        const data = await res.json()
        if (!cancelled) setMessage(data)
      } catch (e: unknown) {
        if (!cancelled) setMsgError(e instanceof Error ? e.message : 'Could not load email')
      } finally {
        if (!cancelled) setMsgLoading(false)
      }
    }

    async function loadSynopsis() {
      setSynopsisLoading(true)
      setSynopsisError(null)
      try {
        const res = await fetch(`/api/gmail/messages/${messageId}/synopsis`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Could not generate summary')
        }
        const data = await res.json()
        if (!cancelled) setSynopsis(data)
      } catch (e: unknown) {
        if (!cancelled) setSynopsisError(e instanceof Error ? e.message : 'Could not generate summary')
      } finally {
        if (!cancelled) setSynopsisLoading(false)
      }
    }

    loadMessage()
    loadSynopsis()
    return () => { cancelled = true }
  }, [messageId])

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          aria-label="Back to inbox"
          style={{
            ...BTN,
            minWidth: 64,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 24,
            border: '2px solid var(--color-border)',
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--color-text)',
          }}
        >
          {msgLoading ? 'Loading…' : (message?.subject || '(no subject)')}
        </h1>
      </div>

      {msgError && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 18, marginBottom: 16 }}>
          {msgError}
        </p>
      )}

      {/* Synopsis card */}
      <section
        aria-label="Email summary"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: 24,
          marginBottom: 16,
          border: '2px solid var(--color-border)',
        }}
      >
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Summary
        </h2>

        {synopsisLoading && (
          <p aria-live="polite" aria-busy="true" style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 18 }}>
            Reading your email…
          </p>
        )}

        {synopsisError && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)', fontSize: 18 }}>
            {synopsisError}
          </p>
        )}

        {synopsis && (
          <div style={{ fontSize: 20, lineHeight: 1.75, color: 'var(--color-text)' }}>
            <ReactMarkdown components={MD_COMPONENTS}>{synopsis.synopsis}</ReactMarkdown>
          </div>
        )}
      </section>

      {/* Show/hide full email toggle */}
      {!showFullEmail ? (
        <button
          onClick={() => setShowFullEmail(true)}
          aria-label="Show full email"
          style={{
            ...BTN,
            width: '100%',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 20,
            border: 'none',
            marginBottom: 8,
          }}
        >
          Show full email
        </button>
      ) : (
        <>
          {/* Email metadata */}
          {message && (
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 12,
                border: '2px solid var(--color-border)',
                fontSize: 16,
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
              }}
            >
              <div><strong style={{ color: 'var(--color-text)' }}>From:</strong> {message.from}</div>
              {message.to && (
                <div><strong style={{ color: 'var(--color-text)' }}>To:</strong> {message.to}</div>
              )}
              <div><strong style={{ color: 'var(--color-text)' }}>Date:</strong> {message.date}</div>
            </div>
          )}

          {/* Email body */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 12,
              border: '2px solid var(--color-border)',
              fontSize: 18,
              lineHeight: 1.8,
              color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {msgLoading ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Loading email…</p>
            ) : (
              message?.body || '(no body)'
            )}
          </div>

          <button
            onClick={() => setShowFullEmail(false)}
            aria-label="Hide email, return to summary"
            style={{
              ...BTN,
              width: '100%',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 18,
              border: '2px solid var(--color-border)',
              marginBottom: 8,
            }}
          >
            Hide email
          </button>
        </>
      )}
    </div>
  )
}

// ── Main inbox view ──────────────────────────────────────────────────────────

export default function GmailView() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadInbox() {
      setLoading(true)
      setError(null)
      setNotConnected(false)
      try {
        const res = await fetch('/api/gmail/messages', { credentials: 'include' })
        if (res.status === 403) {
          if (!cancelled) setNotConnected(true)
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Could not load inbox')
        }
        const data = await res.json()
        if (!cancelled) setMessages(data)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load inbox')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInbox()
    return () => { cancelled = true }
  }, [user])

  // Show email viewer if one is selected
  if (selectedId) {
    return (
      <EmailViewer
        messageId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '24px 16px',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button
          onClick={() => window.history.back()}
          aria-label="Back to home"
          style={{
            ...BTN,
            minWidth: 64,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 24,
            border: '2px solid var(--color-border)',
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
          Gmail
        </h1>
      </div>

      {/* Not connected */}
      {notConnected && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 20,
            padding: 32,
            border: '2px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 20, color: 'var(--color-text)', marginBottom: 24, lineHeight: 1.6 }}>
            Connect Gmail in Settings to use this feature.
          </p>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Go to Settings to connect Gmail"
            style={{
              ...BTN,
              padding: '0 32px',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              fontSize: 20,
            }}
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !notConnected && (
        <p aria-live="polite" aria-busy="true" style={{ fontSize: 20, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 48 }}>
          Loading your inbox…
        </p>
      )}

      {/* Error */}
      {error && (
        <p role="alert" style={{ fontSize: 18, color: 'var(--color-danger)', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {/* Email list */}
      {!loading && !notConnected && !error && (
        <ul
          style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
          aria-label="Inbox messages"
        >
          {messages.length === 0 && (
            <li style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 18, marginTop: 32 }}>
              Your inbox is empty.
            </li>
          )}
          {messages.map(msg => (
            <li key={msg.id}>
              <button
                onClick={() => setSelectedId(msg.id)}
                aria-label={`Email from ${senderName(msg.from)}: ${msg.subject || '(no subject)'}${msg.unread ? ' — unread' : ''}`}
                style={{
                  width: '100%',
                  minHeight: 80,
                  background: 'var(--color-surface)',
                  border: msg.unread ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  borderRadius: 16,
                  cursor: 'pointer',
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: msg.unread ? 700 : 500,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {senderName(msg.from) || '(unknown sender)'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {formatDate(msg.date)}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: msg.unread ? 700 : 500,
                    color: 'var(--color-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {msg.subject || '(no subject)'}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--color-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {msg.snippet}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer style={{ textAlign: 'center', padding: '24px 0 8px', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 'auto' }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
