import { useState, useEffect } from 'react'
import { useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'

const SHORTCUTS = [
  { id: 'menu',      label: "Today's Menu",  icon: '🍽️', color: '#e8a045',               href: '/menu' },
  { id: 'chat',      label: 'Ask anything',  icon: '💬', color: '#7b6ef6',               href: '/chat' },
  { id: 'reminders', label: 'Reminders',     icon: '⏰', color: '#e07858',               href: '/reminders' },
  { id: 'gmail',     label: 'Gmail',         icon: '📧', color: '#4285f4',               href: '/gmail' },
  { id: 'drive',     label: 'Google Drive',  icon: '📁', color: '#34a853',               href: '/drive' },
  { id: 'money',     label: 'Venmo',         icon: '💸', color: '#3d95ce',               href: '/money' },
  { id: 'checkrun',  label: 'Check Run',     icon: '📋', color: '#6c8ebf',               href: '/check-run' },
  { id: 'gif',       label: 'Find a GIF',    icon: '🎭', color: '#e05c6a',               href: '/gif' },
  { id: 'wordle',    label: 'Wordle',        icon: '🟩', color: '#6aaa64',               href: 'https://www.nytimes.com/games/wordle/index.html' },
  { id: 'candy',     label: 'Candy Crush',   icon: '🍬', color: '#ff6b9d',               href: 'https://app.appsflyer.com/id850417475?pid=king-media&c=kingWeb' },
  { id: 'solitaire', label: 'Solitaire',     icon: '🃏', color: '#4caf82',               href: 'https://solitaired.com' },
  { id: 'settings',  label: 'Settings',      icon: '⚙️', color: 'var(--color-text-muted)', href: '/settings' },
]

const ADMIN_COLOR = '#c0392b'

interface CustomCard {
  id: string
  tile_name: string
  last_result: string | null
  last_run_at: number | null
  visibility: string
}

// ── Card detail overlay ───────────────────────────────────────────────────────

function CardDetail({ card, onClose }: { card: CustomCard; onClose: () => void }) {
  const timestamp = card.last_run_at
    ? `Updated ${new Date(card.last_run_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : 'First update pending'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--color-bg)',
      zIndex: 200,
      display: 'flex', flexDirection: 'column',
      padding: '24px 16px',
      maxWidth: 640, margin: '0 auto',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            minHeight: 52, minWidth: 52, borderRadius: 14,
            background: 'var(--color-surface)', border: '2px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >←</button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>
          {card.tile_name}
        </h1>
      </div>

      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-muted)' }}>{timestamp}</p>

      {card.last_result ? (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 18,
          padding: 20, border: '2px solid var(--color-border)',
          fontSize: 17, lineHeight: 1.75, color: 'var(--color-text)',
          whiteSpace: 'pre-wrap',
        }}>
          {card.last_result}
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 18,
          padding: 20, border: '2px solid var(--color-border)',
          textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 17,
        }}>
          First update pending. Your card will run on its next scheduled time.
        </div>
      )}
    </div>
  )
}

// ── Main Home ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { profile } = useProfile()
  const { user, logout } = useAuth()
  const name = profile.name || 'there'
  const isAdmin = user?.role === 'admin'

  // Admin: fetch pending request count to show a badge on the Admin tile.
  // Only called when role is confirmed admin (server-verified via /api/auth/me).
  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/pending-count', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPendingCount(data.count) })
      .catch(() => {})
  }, [isAdmin])

  const [cards, setCards] = useState<CustomCard[]>([])
  const [activeCard, setActiveCard] = useState<CustomCard | null>(null)

  useEffect(() => {
    fetch('/api/cards', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setCards(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  if (activeCard) {
    return <CardDetail card={activeCard} onClose={() => setActiveCard(null)} />
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
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 'var(--fs-base)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-text)', margin: '4px 0 0' }}>
          Hi, {name}.
        </h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {SHORTCUTS.map((s) => {
          const isExternal = s.href.startsWith('http')
          return (
            <a
              key={s.id}
              href={s.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              onClick={isExternal ? undefined : (e) => { e.preventDefault(); navigate(s.href) }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 20,
                padding: '24px 12px',
                minHeight: 120,
                textDecoration: 'none',
                color: 'var(--color-text)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = s.color)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
              onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = s.color)}
              onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
            >
              <span style={{ fontSize: 36 }} role="img" aria-hidden="true">{s.icon}</span>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, textAlign: 'center' }}>{s.label}</span>
            </a>
          )
        })}

        {/* Admin tile — only rendered for role=admin, confirmed from /api/auth/me */}
        {isAdmin && (
          <a
            href="/admin"
            onClick={(e) => { e.preventDefault(); navigate('/admin') }}
            aria-label={pendingCount > 0 ? `Admin — ${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : 'Admin'}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 20,
              padding: '24px 12px',
              minHeight: 120,
              textDecoration: 'none',
              color: 'var(--color-text)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = ADMIN_COLOR)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
            onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = ADMIN_COLOR)}
            onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
          >
            {pendingCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 12,
                  background: ADMIN_COLOR,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 99,
                  minWidth: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  lineHeight: 1,
                }}
              >
                {pendingCount}
              </span>
            )}
            <span style={{ fontSize: 36 }} role="img" aria-hidden="true">🔑</span>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, textAlign: 'center' }}>Admin</span>
          </a>
        )}

        {/* Custom AI Cards */}
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => setActiveCard(card)}
            aria-label={`${card.tile_name}${card.last_run_at ? `, updated ${new Date(card.last_run_at * 1000).toLocaleDateString()}` : ', first update pending'}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 20,
              padding: '24px 12px',
              minHeight: 120,
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#7b6ef6')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
            onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#7b6ef6')}
            onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
          >
            <span style={{ fontSize: 36 }} role="img" aria-hidden="true">✨</span>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, textAlign: 'center' }}>{card.tile_name}</span>
            {!card.last_run_at && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Pending first update</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={logout}
        aria-label="Sign out"
        style={{
          marginTop: 16,
          width: '100%',
          minHeight: 64,
          borderRadius: 16,
          border: '2px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text-muted)',
          fontSize: 17,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Sign out
      </button>

      <footer style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
