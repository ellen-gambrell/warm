/**
 * MenuEditor — supporter-facing menu editing interface.
 * Available to: key_contact, family_secondary, homemaker.
 */

import { useState, useEffect, useCallback } from 'react'

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

// All five sections (including empty ones for editing)
const ALL_SECTIONS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'leftovers', label: 'Leftovers', emoji: '🥡' },
  { key: 'snacks',    label: 'Snacks',    emoji: '🥨' },
  { key: 'sweets',    label: 'Sweets',    emoji: '🍪' },
  { key: 'drinks',    label: 'Drinks',    emoji: '🥤' },
]

const BTN: React.CSSProperties = {
  minHeight: 64,
  borderRadius: 16,
  border: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 18,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

function formatPublished(iso: string | null): string {
  if (!iso) return 'Never published'
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return isToday ? `Updated today at ${time}` : `Updated ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`
}

export default function MenuEditor() {
  const [menuData, setMenuData] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [publishing, setPublishing] = useState(false)
  const [publishedMsg, setPublishedMsg] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  const fetchMenu = useCallback(async () => {
    try {
      const r = await fetch('/api/supporter/menu', { credentials: 'include' })
      if (!r.ok) throw new Error('Could not load menu.')
      const data: MenuData = await r.json()
      // Merge API sections (non-empty) with full section list to always show all sections
      const byKey: Record<string, MenuItem[]> = {}
      data.sections.forEach(s => { byKey[s.key] = s.items })
      const allSections: Section[] = ALL_SECTIONS.map(s => ({
        ...s,
        items: byKey[s.key] ?? [],
      }))
      setMenuData({ sections: allSections, last_published: data.last_published })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load menu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  const addItem = async (section: string) => {
    const name = (inputs[section] ?? '').trim()
    if (!name || actionBusy) return
    setActionBusy(true)
    try {
      const r = await fetch('/api/supporter/menu/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ section, name }),
      })
      if (!r.ok) throw new Error()
      setInputs(prev => ({ ...prev, [section]: '' }))
      await fetchMenu()
    } catch {
      // silently fail — item wasn't added
    } finally {
      setActionBusy(false)
    }
  }

  const removeItem = async (id: string) => {
    if (actionBusy) return
    setActionBusy(true)
    try {
      await fetch(`/api/supporter/menu/item/${id}`, { method: 'DELETE', credentials: 'include' })
      await fetchMenu()
    } catch {
      // ignore
    } finally {
      setActionBusy(false)
    }
  }

  const clearSection = async (section: string) => {
    if (actionBusy) return
    setActionBusy(true)
    try {
      await fetch(`/api/supporter/menu/section/${section}`, { method: 'DELETE', credentials: 'include' })
      await fetchMenu()
    } catch {
      // ignore
    } finally {
      setActionBusy(false)
    }
  }

  const publish = async () => {
    setPublishing(true)
    setPublishedMsg('')
    try {
      const r = await fetch('/api/supporter/menu/publish', { method: 'POST', credentials: 'include' })
      if (!r.ok) throw new Error()
      setPublishedMsg('Menu updated! Margaret can see it now. ✓')
      await fetchMenu()
    } catch {
      setPublishedMsg('Could not publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <p style={{ padding: 24, fontSize: 20, color: 'var(--color-text-muted)' }}>Loading menu…</p>
  if (error) return <p style={{ padding: 24, fontSize: 20, color: 'var(--color-danger)' }}>{error}</p>
  if (!menuData) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Last published */}
      <p style={{ margin: '0 0 24px', fontSize: 16, color: 'var(--color-text-muted)' }}>
        {formatPublished(menuData.last_published)}
      </p>

      {/* Sections */}
      {menuData.sections.map(section => (
        <div
          key={section.key}
          style={{
            marginBottom: 24,
            background: 'var(--color-surface)',
            borderRadius: 20,
            border: '2px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: section.items.length ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
              {section.emoji} {section.label}
            </h2>
            {section.items.length > 0 && (
              <button
                onClick={() => clearSection(section.key)}
                disabled={actionBusy}
                aria-label={`Clear all ${section.label}`}
                style={{
                  ...BTN,
                  minHeight: 44,
                  padding: '0 14px',
                  fontSize: 15,
                  background: 'transparent',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--color-danger)',
                  opacity: actionBusy ? 0.5 : 1,
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Items */}
          {section.items.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: '1px solid var(--color-border)',
                minHeight: 64,
              }}
            >
              <span style={{ fontSize: 19, color: 'var(--color-text)' }}>{item.name}</span>
              <button
                onClick={() => removeItem(item.id)}
                disabled={actionBusy}
                aria-label={`Remove ${item.name}`}
                style={{
                  ...BTN,
                  minHeight: 48,
                  minWidth: 48,
                  padding: 0,
                  fontSize: 22,
                  background: 'transparent',
                  color: 'var(--color-danger)',
                  flexShrink: 0,
                  opacity: actionBusy ? 0.5 : 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add item */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>
            <input
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: 12,
                border: '2px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 18,
                padding: '0 16px',
                fontFamily: 'inherit',
              }}
              type="text"
              placeholder="Add item…"
              value={inputs[section.key] ?? ''}
              onChange={e => setInputs(prev => ({ ...prev, [section.key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addItem(section.key)}
            />
            <button
              onClick={() => addItem(section.key)}
              disabled={actionBusy || !(inputs[section.key] ?? '').trim()}
              aria-label={`Add to ${section.label}`}
              style={{
                ...BTN,
                minWidth: 64,
                padding: '0 16px',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 22,
                opacity: actionBusy || !(inputs[section.key] ?? '').trim() ? 0.5 : 1,
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}

      {/* Publish */}
      {publishedMsg && (
        <p
          role="status"
          style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: publishedMsg.includes('✓') ? 'var(--color-success, #2d8a4e)' : 'var(--color-danger)',
            margin: '0 0 16px',
          }}
        >
          {publishedMsg}
        </p>
      )}
      <button
        onClick={publish}
        disabled={publishing}
        style={{
          ...BTN,
          width: '100%',
          background: '#2d8a4e',
          color: '#fff',
          fontSize: 22,
          minHeight: 72,
          opacity: publishing ? 0.6 : 1,
        }}
      >
        {publishing ? 'Publishing…' : '✓ Publish menu'}
      </button>
    </div>
  )
}
