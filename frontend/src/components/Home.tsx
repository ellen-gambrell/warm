import { useProfile } from '../context/ProfileContext'

const SHORTCUTS = [
  { id: 'chat', label: 'Ask anything', icon: '💬', color: '#7b6ef6', href: '/chat' },
  { id: 'gmail', label: 'Gmail', icon: '📧', color: '#4285f4', href: '/gmail' },
  { id: 'drive', label: 'Google Drive', icon: '📁', color: '#34a853', href: '/drive' },
  { id: 'money', label: 'My Money', icon: '💰', color: '#f0956a', href: '/money' },
  { id: 'gif', label: 'Find a GIF', icon: '🎭', color: '#e05c6a', href: '/gif' },
  { id: 'wordle', label: 'Wordle', icon: '🟩', color: '#6aaa64', href: 'https://www.nytimes.com/games/wordle/index.html' },
  { id: 'candy', label: 'Candy Crush', icon: '🍬', color: '#ff6b9d', href: 'https://www.king.com/game/candycrush' },
  { id: 'solitaire', label: 'Solitaire', icon: '🃏', color: '#4caf82', href: 'https://solitaired.com' },
]

export default function Home() {
  const { profile } = useProfile()
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
          const Tag = isExternal ? 'a' : 'a'
          return (
            <Tag
              key={s.id}
              href={s.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
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
              onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = s.color)}
              onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
            >
              <span style={{ fontSize: 36 }} role="img" aria-hidden="true">{s.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 600, textAlign: 'center' }}>{s.label}</span>
            </Tag>
          )
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 32, textAlign: 'center' }}>
        <a
          href="/settings"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-block',
            padding: '12px 24px',
          }}
        >
          Settings
        </a>
      </div>

      <footer style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
