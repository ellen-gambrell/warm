import { useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'

const SHORTCUTS = [
  { id: 'menu', label: "Today's Menu", icon: '🍽️', color: '#e8a045', href: '/menu' },
  { id: 'chat', label: 'Ask anything', icon: '💬', color: '#7b6ef6', href: '/chat' },
  { id: 'gmail', label: 'Gmail', icon: '📧', color: '#4285f4', href: '/gmail' },
  { id: 'drive', label: 'Google Drive', icon: '📁', color: '#34a853', href: '/drive' },
  { id: 'money', label: 'Venmo', icon: '💸', color: '#3d95ce', href: '/money' },
  { id: 'checkrun', label: 'Check Run', icon: '📋', color: '#6c8ebf', href: '/check-run' },
  { id: 'gif', label: 'Find a GIF', icon: '🎭', color: '#e05c6a', href: '/gif' },
  { id: 'wordle', label: 'Wordle', icon: '🟩', color: '#6aaa64', href: 'https://www.nytimes.com/games/wordle/index.html' },
  { id: 'candy', label: 'Candy Crush', icon: '🍬', color: '#ff6b9d', href: 'https://app.appsflyer.com/id850417475?pid=king-media&c=kingWeb' },
  { id: 'solitaire', label: 'Solitaire', icon: '🃏', color: '#4caf82', href: 'https://solitaired.com' },
  { id: 'settings', label: 'Settings', icon: '⚙️', color: 'var(--color-text-muted)', href: '/settings' },
]

export default function Home() {
  const { profile } = useProfile()
  const { logout } = useAuth()
  const name = profile.name || 'there'

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
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 16 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-text)', margin: '4px 0 0' }}>
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
              <span style={{ fontSize: 15, fontWeight: 600, textAlign: 'center' }}>{s.label}</span>
            </a>
          )
        })}
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
