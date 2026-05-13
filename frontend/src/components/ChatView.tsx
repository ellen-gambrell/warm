import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import ConfirmationPanel, { type PendingAction } from './ConfirmationPanel'
import { NAVBAR_HEIGHT } from './NavBar'
import { useTrackVisit } from '../hooks/useTrackVisit'

// ── Typing indicator ───────────────────────────────────────────────────────────

const TYPING_STYLE = `
@keyframes wc-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%            { transform: translateY(-8px); opacity: 1; }
}
.wc-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  background: var(--color-accent); margin: 0 3px;
  animation: wc-bounce 1.2s ease-in-out infinite; }
.wc-dot:nth-child(2) { animation-delay: 0.2s; }
.wc-dot:nth-child(3) { animation-delay: 0.4s; }
`

function TypingIndicator() {
  return (
    <>
      <style>{TYPING_STYLE}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div
          aria-busy="true"
          aria-label="Assistant is thinking"
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: '20px 20px 20px 4px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span className="wc-dot" />
          <span className="wc-dot" />
          <span className="wc-dot" />
        </div>
      </div>
    </>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'model'
  text: string
  usedFinancialContext?: boolean
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  minHeight: 64,
  minWidth: 64,
  borderRadius: 16,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: 'none',
  fontWeight: 700,
  fontSize: 18,
  transition: 'opacity 0.15s',
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

const MD_COMPONENTS = {
  p:      ({ children }: { children?: React.ReactNode }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  ul:     ({ children }: { children?: React.ReactNode }) => <ul style={{ margin: '0 0 10px', paddingLeft: 24, listStyleType: 'disc' }}>{children}</ul>,
  ol:     ({ children }: { children?: React.ReactNode }) => <ol style={{ margin: '0 0 10px', paddingLeft: 24, listStyleType: 'decimal' }}>{children}</ol>,
  li:     ({ children }: { children?: React.ReactNode }) => <li style={{ marginBottom: 4, display: 'list-item' }}>{children}</li>,
  a:      ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--color-accent)', textDecorationSkipInk: 'auto' }}>
      {children}
    </a>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{children}</h3>,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Summarize my latest email',
  'Write an email to Shannon asking if she can help me tomorrow',
  'What did I spend on groceries this month?',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }

const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  !!((window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition)

const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Strip markdown formatting so TTS reads cleanly. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/---+/g, '')
    .trim()
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChatView() {
  useTrackVisit('chat')
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [isLoading,  setIsLoading]  = useState(false)
  const [isListening, setIsListening] = useState(false)

  // ConfirmationPanel
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy,    setActionBusy]    = useState(false)

  // TTS
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [autoRead,      setAutoRead]      = useState(false)
  const lastSpokenIndex = useRef(-1)

  const bottomRef       = useRef<HTMLDivElement>(null)
  const recognitionRef  = useRef<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const speechFinalRef  = useRef('')           // tracks last final speech transcript
  const sendMessageRef  = useRef<(text: string) => void>(() => {})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Cancel TTS on unmount
  useEffect(() => {
    return () => { if (hasTTS) window.speechSynthesis.cancel() }
  }, [])

  // ── TTS helpers ──────────────────────────────────────────────────────────────

  function speakMessage(text: string, index: number) {
    if (!hasTTS) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(stripMarkdown(text))
    utter.rate  = 0.95
    utter.pitch = 1.0
    utter.onstart = () => setSpeakingIndex(index)
    utter.onend   = () => setSpeakingIndex(null)
    utter.onerror = () => setSpeakingIndex(null)
    window.speechSynthesis.speak(utter)
  }

  function toggleSpeakMessage(text: string, index: number) {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel()
      setSpeakingIndex(null)
    } else {
      speakMessage(text, index)
    }
  }

  // Auto-read new AI messages when autoRead is on
  useEffect(() => {
    if (!autoRead || !hasTTS) return
    const lastIdx = messages.length - 1
    if (lastIdx < 0) return
    if (messages[lastIdx].role !== 'model') return
    if (lastIdx === lastSpokenIndex.current) return
    lastSpokenIndex.current = lastIdx
    speakMessage(messages[lastIdx].text, lastIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, autoRead])

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const newUserMsg: Message = { role: 'user', text: trimmed }
      const history = messages
      setMessages((prev) => [...prev, newUserMsg])
      setInput('')
      setIsLoading(true)

      // Unlock speechSynthesis on iOS (must happen in user-gesture context)
      if (hasTTS && autoRead) {
        const warmUp = new SpeechSynthesisUtterance('')
        window.speechSynthesis.speak(warmUp)
      }

      try {
        const res = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: trimmed,
            history: history.map((m) => ({ role: m.role, text: m.text })),
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Something went wrong. Please try again.')
        }

        const data = await res.json()

        // Show the AI's reply text
        if (data.reply) {
          setMessages((prev) => [...prev, {
            role: 'model',
            text: data.reply,
            usedFinancialContext: !!data.used_financial_context,
          }])
        }

        // Show ConfirmationPanel if the AI proposed an action
        if (data.pending_action) {
          setPendingAction(data.pending_action)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
        setMessages((prev) => [...prev, { role: 'model', text: msg }])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, isLoading, autoRead]
  )

  // Keep sendMessageRef current so voice onend can call the latest version
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Keyboard ─────────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Voice input ───────────────────────────────────────────────────────────────

  const toggleMic = () => {
    if (!hasSpeechRecognition) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionClass =
      (window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition

    const recognition = new SpeechRecognitionClass()
    recognition.continuous     = false
    recognition.interimResults = true
    recognition.lang           = 'en-US'

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final   = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      const transcript = final || interim
      speechFinalRef.current = transcript
      setInput(transcript)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-send on speech end — no second tap needed
      const finalText = speechFinalRef.current
      speechFinalRef.current = ''
      if (finalText.trim()) {
        sendMessageRef.current(finalText.trim())
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      speechFinalRef.current = ''
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  // ── Confirmation panel actions ────────────────────────────────────────────────

  async function executeAction() {
    if (!pendingAction) return
    setActionBusy(true)
    try {
      if (pendingAction.type === 'compose_email') {
        const p = pendingAction.params
        const toEmail = (p.to_email as string) || ''
        const subject = (p.subject as string) || ''
        const body    = (p.body    as string) || ''
        const mailtoUrl =
          `mailto:${encodeURIComponent(toEmail)}` +
          `?subject=${encodeURIComponent(subject)}` +
          `&body=${encodeURIComponent(body)}`
        window.open(mailtoUrl)
        setMessages((prev) => [...prev, {
          role: 'model',
          text: '📧 Email opened in your mail app. Tap Send when you\'re ready.',
        }])
      }
    } finally {
      setPendingAction(null)
      setActionBusy(false)
    }
  }

  function cancelAction() {
    setPendingAction(null)
    setMessages((prev) => [...prev, {
      role: 'model',
      text: 'Got it — I won\'t send anything.',
    }])
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: `calc(100dvh - ${NAVBAR_HEIGHT}px)`,
        background: 'var(--color-bg)',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, flex: 1, color: 'var(--color-text)' }}>
          Ask anything
        </h1>

        {/* Auto-read toggle */}
        {hasTTS && (
          <button
            onClick={() => setAutoRead(v => !v)}
            aria-label={autoRead ? 'Auto-read on — tap to turn off' : 'Auto-read off — tap to turn on'}
            aria-pressed={autoRead}
            title={autoRead ? 'Auto-read: on' : 'Auto-read: off'}
            style={{
              ...BTN,
              minWidth: 52,
              background: autoRead ? 'var(--color-accent)' : 'var(--color-surface)',
              color: autoRead ? '#fff' : 'var(--color-text)',
              border: '2px solid var(--color-border)',
              fontSize: 22,
            }}
          >
            {autoRead ? '🔊' : '🔇'}
          </button>
        )}

        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([])
              if (hasTTS) window.speechSynthesis.cancel()
              setSpeakingIndex(null)
              lastSpokenIndex.current = -1
            }}
            aria-label="Start new conversation"
            style={{
              ...BTN,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 15,
              padding: '0 16px',
              minWidth: 'auto',
            }}
          >
            New chat
          </button>
        )}
      </div>

      {/* ── Message list ── */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div
            style={{
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              paddingBottom: 24,
            }}
          >
            <div
              style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 20,
                padding: '24px 20px',
                textAlign: 'center',
                maxWidth: 360,
              }}
            >
              <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--color-text)' }}>
                Hi, what can I help you with today?
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  style={{
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    fontSize: 17,
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    minHeight: 64,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                padding: '14px 16px',
                fontSize: 18,
                lineHeight: 1.6,
                border: msg.role === 'model' ? '2px solid var(--color-border)' : 'none',
              }}
            >
              {msg.role === 'model' ? (
                <ReactMarkdown components={MD_COMPONENTS}>{msg.text}</ReactMarkdown>
              ) : (
                msg.text
              )}
            </div>

            {/* Financial context disclosure — shown when Monarch data was sent to AI */}
            {msg.role === 'model' && msg.usedFinancialContext && (
              <span
                aria-label="This response used your financial data from Monarch Money"
                title="This response used your financial data from Monarch Money"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '2px 8px',
                  userSelect: 'none',
                }}
              >
                💰 Used your financial data
              </span>
            )}

            {/* Read aloud button — AI messages only */}
            {msg.role === 'model' && hasTTS && (
              <button
                onClick={() => toggleSpeakMessage(msg.text, i)}
                aria-label={speakingIndex === i ? 'Stop reading' : 'Read message aloud'}
                aria-pressed={speakingIndex === i}
                style={{
                  background: speakingIndex === i ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: speakingIndex === i ? '#fff' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '4px 12px',
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 36,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {speakingIndex === i ? '⏹ Stop' : '🔊 Read'}
              </button>
            )}
          </div>
        ))}

        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          flexShrink: 0,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        {/* Mic button */}
        {hasSpeechRecognition && (
          <button
            onClick={toggleMic}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={isListening}
            style={{
              ...BTN,
              background: isListening ? 'var(--color-danger)' : 'var(--color-surface)',
              color: isListening ? '#fff' : 'var(--color-text)',
              border: '2px solid var(--color-border)',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            🎤
          </button>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={isListening ? 'Listening…' : 'Type a message…'}
          aria-label="Message input"
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--color-surface)',
            border: `2px solid ${isListening ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 16,
            padding: '14px 16px',
            fontSize: 18,
            fontFamily: 'inherit',
            color: 'var(--color-text)',
            minHeight: 56,
            outline: 'none',
            lineHeight: 1.5,
            transition: 'border-color 0.15s',
          }}
        />

        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          style={{
            ...BTN,
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 24,
            flexShrink: 0,
            opacity: !input.trim() || isLoading ? 0.5 : 1,
          }}
        >
          ▶
        </button>
      </div>

      {/* ── Confirmation panel (overlays everything) ── */}
      {pendingAction && (
        <ConfirmationPanel
          action={pendingAction}
          onConfirm={executeAction}
          onCancel={cancelAction}
          busy={actionBusy}
        />
      )}
    </div>
  )
}
