import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'
import ConfirmationPanel, { type PendingAction } from './ConfirmationPanel'
import { useTrackVisit } from '../hooks/useTrackVisit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }
const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  !!((window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition)

interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string
  snippet: string
  unread: boolean
  hasAttachment: boolean
}

interface GmailFullMessage extends GmailMessage {
  to: string
  cc?: string
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

  // ── Reply state ──────────────────────────────────────────────────────────────
  const [replyMode, setReplyMode] = useState<'none' | 'reply' | 'replyAll'>('none')
  const [replyBody, setReplyBody] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  function startListening() {
    if (!hasSpeechRecognition) return
    const AW = window as AnyWindow
    const SR = AW.SpeechRecognition || AW.webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setReplyBody(prev => prev ? prev + ' ' + transcript : transcript)
    }
    rec.onerror = () => { setIsListening(false) }
    rec.onend  = () => { setIsListening(false) }
    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  function toggleListening() {
    if (isListening) stopListening()
    else startListening()
  }

  function openReply(mode: 'reply' | 'replyAll') {
    setReplyMode(mode)
    setReplyBody('')
    setSendSuccess(false)
    setSendError(null)
    if (isListening) stopListening()
  }

  function cancelReply() {
    if (isListening) stopListening()
    setReplyMode('none')
    setReplyBody('')
    setSendSuccess(false)
    setSendError(null)
  }

  function reviewAndSend() {
    if (!message) return
    const name = senderName(message.from)
    const label = replyMode === 'replyAll'
      ? `Reply All to ${name}`
      : `Reply to ${name}`
    const preview = replyBody.slice(0, 100).trimEnd() + (replyBody.length > 100 ? '…' : '')
    const toAddr = replyMode === 'replyAll'
      ? [message.from, message.to, message.cc].filter(Boolean).join(', ')
      : message.from
    setPendingAction({
      type: 'send_reply',
      label,
      description: preview,
      params: {
        to: toAddr,
        body: replyBody,
      },
    })
  }

  async function executeReply() {
    if (!pendingAction) return
    setActionBusy(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/gmail/messages/${messageId}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyBody,
          reply_all: replyMode === 'replyAll',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Could not send reply')
      }
      setPendingAction(null)
      setReplyMode('none')
      setReplyBody('')
      setSendSuccess(true)
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Could not send reply')
      setPendingAction(null)
    } finally {
      setActionBusy(false)
    }
  }

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

      {/* ── Reply / Reply All buttons ────────────────────────────────────────── */}
      {message && replyMode === 'none' && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => openReply('reply')}
            aria-label="Reply to sender"
            style={{
              ...BTN,
              flex: 1,
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              fontSize: 18,
            }}
          >
            ↩ Reply
          </button>
          <button
            onClick={() => openReply('replyAll')}
            aria-label="Reply to all recipients"
            style={{
              ...BTN,
              flex: 1,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '2px solid var(--color-border)',
              fontSize: 18,
            }}
          >
            ↩ Reply All
          </button>
        </div>
      )}

      {/* ── Send success ─────────────────────────────────────────────────────── */}
      {sendSuccess && (
        <p
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: '14px 18px',
            background: 'var(--color-surface)',
            border: '2px solid var(--color-accent)',
            borderRadius: 14,
            fontSize: 18,
            color: 'var(--color-accent)',
            fontWeight: 700,
          }}
        >
          ✓ Reply sent.
        </p>
      )}

      {/* ── Send error ───────────────────────────────────────────────────────── */}
      {sendError && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 16, marginTop: 12 }}>
          {sendError}
        </p>
      )}

      {/* ── Compose panel ───────────────────────────────────────────────────── */}
      {replyMode !== 'none' && (
        <div
          style={{
            marginTop: 20,
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {replyMode === 'replyAll' ? 'Reply All' : 'Reply'}
            {message && ` · To: ${senderName(message.from)}`}
            {replyMode === 'replyAll' && message && (message.to || message.cc) ? ' + others' : ''}
          </p>

          {/* Textarea */}
          <textarea
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Type your reply here, or tap the mic to dictate…"
            aria-label="Reply message body"
            rows={5}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              fontSize: 18,
              lineHeight: 1.6,
              padding: '12px 14px',
              borderRadius: 14,
              border: '2px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              resize: 'vertical',
            }}
          />

          {/* Mic button */}
          {hasSpeechRecognition && (
            <button
              onClick={toggleListening}
              aria-label={isListening ? 'Stop dictation' : 'Start voice dictation'}
              aria-pressed={isListening}
              style={{
                ...BTN,
                alignSelf: 'flex-start',
                padding: '0 24px',
                background: isListening ? 'var(--color-accent)' : 'var(--color-surface)',
                color: isListening ? '#fff' : 'var(--color-text)',
                border: isListening ? 'none' : '2px solid var(--color-border)',
                fontSize: 18,
              }}
            >
              {isListening ? '⏹ Stop dictation' : '🎤 Dictate'}
            </button>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={cancelReply}
              aria-label="Cancel reply"
              style={{
                ...BTN,
                flex: 1,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '2px solid var(--color-border)',
                fontSize: 17,
              }}
            >
              Cancel
            </button>
            <button
              onClick={reviewAndSend}
              disabled={!replyBody.trim()}
              aria-label="Review and send reply"
              style={{
                ...BTN,
                flex: 2,
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                fontSize: 17,
                opacity: replyBody.trim() ? 1 : 0.4,
              }}
            >
              Review &amp; Send
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation overlay ─────────────────────────────────────────────── */}
      {pendingAction && (
        <ConfirmationPanel
          action={pendingAction}
          onConfirm={executeReply}
          onCancel={() => setPendingAction(null)}
          busy={actionBusy}
        />
      )}
    </div>
  )
}

// ── Main inbox view ──────────────────────────────────────────────────────────

export default function GmailView() {
  useTrackVisit('gmail')
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
      <div style={{ marginBottom: 32 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: msg.unread ? 700 : 500,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {msg.subject || '(no subject)'}
                  </span>
                  {msg.hasAttachment && (
                    <span
                      aria-label="Has attachment"
                      role="img"
                      style={{ fontSize: 15, flexShrink: 0 }}
                    >
                      📎
                    </span>
                  )}
                </div>
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
        <p style={{ margin: '4px 0 0' }}>
          <a href="/privacy" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}>Privacy policy</a>
        </p>
      </footer>
    </div>
  )
}
