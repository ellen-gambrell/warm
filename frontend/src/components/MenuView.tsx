/**
 * MenuView — Margaret's read-only daily menu.
 * Route: /menu
 */

import { useState, useEffect } from 'react'
import { useTrackVisit } from '../hooks/useTrackVisit'

interface MenuItem {
  id: string
  name: string
}

interface Section {
  key: string
  label: string
  emoji: string
  items: MenuItem[]
}

interface MenuData {
  sections: Section[]
  last_published: string | null
}

function formatPublished(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Updated today at ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Updated yesterday at ${time}`
  return `Updated ${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`
}

export default function MenuView() {
  useTrackVisit('menu')
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/menu', { credentials: 'include' })
      .then(async r => {
        if (!r.ok) throw new Error('Could not load menu.')
        return r.json()
      })
      .then(setMenu)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '16px 16px 48px',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
            🍽️ Today's Menu
          </h1>
          {menu?.last_published && (
            <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--color-text-muted)' }}>
              {formatPublished(menu.last_published)}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <p style={{ fontSize: 20, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 60 }}>
          Loading menu…
        </p>
      )}

      {/* Error */}
      {error && (
        <p role="alert" style={{ fontSize: 20, color: 'var(--color-danger)', textAlign: 'center', marginTop: 60 }}>
          {error}
        </p>
      )}

      {/* Empty state */}
      {menu && menu.sections.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>🍽️</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
            Nothing on the menu yet
          </p>
          <p style={{ fontSize: 18, color: 'var(--color-text-muted)', margin: 0 }}>
            Check back soon.
          </p>
        </div>
      )}

      {/* Menu sections */}
      {menu && menu.sections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {menu.sections.map((section, i) => (
            <div
              key={section.key}
              style={{
                borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                paddingTop: i > 0 ? 28 : 0,
                paddingBottom: 28,
              }}
            >
              {/* Section header */}
              <h2
                style={{
                  margin: '0 0 14px',
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span aria-hidden="true">{section.emoji}</span>
                {section.label}
              </h2>

              {/* Items */}
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map(item => (
                  <li
                    key={item.id}
                    style={{
                      fontSize: 22,
                      lineHeight: 1.6,
                      color: 'var(--color-text)',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
