import { useState, useEffect, useRef } from 'react'
import { navigate } from '../App'

interface GifResult {
  id: string
  title: string
  url: string
  preview: string
}

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

export default function GifView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GifResult[]>([])
  const [configured, setConfigured] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(q)}&limit=20`, { credentials: 'include' })
      const data = await res.json()
      setConfigured(data.configured)
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load trending GIFs on mount
  useEffect(() => {
    search('')
  }, [])

  const handleSearch = () => {
    search(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const copyGif = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToast('Copied! ✓')
      toastTimerRef.current = setTimeout(() => setToast(null), 2000)
    } catch {
      // fallback: silently ignore if clipboard not available
    }
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          style={{ ...BTN, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 24 }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>
          Find a GIF
        </h1>
      </div>

      {/* ── Search bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search GIFs…"
          aria-label="Search GIFs"
          style={{
            flex: 1,
            height: 64,
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 16,
            padding: '0 16px',
            fontSize: 18,
            fontFamily: 'inherit',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          aria-label="Search"
          style={{
            ...BTN,
            background: 'var(--color-accent)',
            color: '#fff',
            padding: '0 20px',
            minWidth: 'auto',
          }}
        >
          Search
        </button>
      </div>

      {/* ── Not configured ── */}
      {!configured && (
        <div
          role="status"
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 20,
            padding: 24,
            fontSize: 18,
            color: 'var(--color-text)',
            lineHeight: 1.6,
          }}
        >
          GIF search isn't set up yet. Add <code>TENOR_API_KEY</code> to{' '}
          <code>backend/.env</code> to enable it.
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <p
          aria-busy="true"
          style={{ textAlign: 'center', fontSize: 18, color: 'var(--color-text-muted)', padding: '24px 0' }}
        >
          Searching…
        </p>
      )}

      {/* ── No results ── */}
      {!isLoading && configured && hasSearched && results.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 18, color: 'var(--color-text-muted)', padding: '24px 0' }}>
          No GIFs found. Try different words.
        </p>
      )}

      {/* ── Results grid ── */}
      {!isLoading && results.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Tap any GIF to copy its link
          </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {results.map((gif) => (
            <button
              key={gif.id}
              onClick={() => copyGif(gif.url)}
              aria-label={`Copy GIF: ${gif.title || 'GIF'}`}
              style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: 16,
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 64,
              }}
            >
              <img
                src={gif.preview}
                alt={gif.title || 'GIF'}
                loading="lazy"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
            </button>
          ))}
        </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 16,
            padding: '14px 24px',
            fontSize: 18,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
