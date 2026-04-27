import { useState, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../context/AuthContext'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Use CDN worker — works in all environments without extra Vite config
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const ZOOM_PRESETS = [100, 150, 200, 300] as const

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

interface Props {
  file: File
  onClose: () => void
}

export default function DocumentViewer({ file, onClose }: Props) {
  const { user } = useAuth()
  const [synopsis, setSynopsis] = useState<string | null>(null)
  const [synopsisLoading, setSynopsisLoading] = useState(true)
  const [synopsisError, setSynopsisError] = useState<string | null>(null)
  const [showDocument, setShowDocument] = useState(false)
  const [zoom, setZoom] = useState(150)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  // Create an object URL so react-pdf can load the file locally
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Fetch synopsis from backend
  useEffect(() => {
    let cancelled = false
    setSynopsisLoading(true)
    setSynopsisError(null)
    setSynopsis(null)

    const run = async () => {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/documents/synopsis', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Could not generate summary')
        }
        const data = await res.json()
        if (!cancelled) setSynopsis(data.synopsis)
      } catch (e: unknown) {
        if (!cancelled) {
          setSynopsisError(
            e instanceof Error ? e.message : 'Could not generate summary. You can still view the document.'
          )
        }
      } finally {
        if (!cancelled) setSynopsisLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [file, user])

  const adjustZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(400, Math.max(75, prev + delta)))
  }, [])

  const isPdf = file.type === 'application/pdf'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '16px',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onClose}
          aria-label="Go back"
          style={{ ...BTN, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 24 }}
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
          title={file.name}
        >
          {file.name}
        </h1>
      </div>

      {/* ── Synopsis card ── */}
      <section
        aria-label="Document summary"
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
          <p
            aria-live="polite"
            aria-busy="true"
            style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 18 }}
          >
            Reading your document…
          </p>
        )}

        {synopsisError && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--color-danger)', fontSize: 18 }}
          >
            {synopsisError}
          </p>
        )}

        {synopsis && (
          <div style={{ fontSize: 20, lineHeight: 1.75, color: 'var(--color-text)' }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 12px' }}>{children}</p>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 700 }}>{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 12px', paddingLeft: 28, listStyleType: 'disc' }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: '0 0 12px', paddingLeft: 28, listStyleType: 'decimal' }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 6, display: 'list-item' }}>{children}</li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)', textDecorationSkipInk: 'auto' }}
                  >
                    {children}
                  </a>
                ),
                h1: ({ children }) => (
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{children}</h3>
                ),
              }}
            >
              {synopsis}
            </ReactMarkdown>
          </div>
        )}
      </section>

      {/* ── Show / hide document toggle ── */}
      {!showDocument ? (
        <button
          onClick={() => setShowDocument(true)}
          aria-label="Show full document"
          style={{
            ...BTN,
            width: '100%',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 20,
            marginBottom: 8,
          }}
        >
          Show full document
        </button>
      ) : (
        <>
          {/* ── Zoom controls ── */}
          <div
            role="group"
            aria-label="Zoom controls"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => adjustZoom(-25)}
              aria-label="Zoom out"
              style={{
                ...BTN,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 28,
                border: '2px solid var(--color-border)',
              }}
            >
              −
            </button>

            {ZOOM_PRESETS.map(preset => {
              const active = zoom === preset
              return (
                <button
                  key={preset}
                  onClick={() => setZoom(preset)}
                  aria-label={`Zoom to ${preset} percent`}
                  aria-pressed={active}
                  style={{
                    ...BTN,
                    minWidth: 0,
                    padding: '0 18px',
                    fontSize: 16,
                    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: active ? '#fff' : 'var(--color-text)',
                    border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  }}
                >
                  {preset}%
                </button>
              )
            })}

            <button
              onClick={() => adjustZoom(25)}
              aria-label="Zoom in"
              style={{
                ...BTN,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 28,
                border: '2px solid var(--color-border)',
              }}
            >
              +
            </button>

            {/* Live zoom readout for screen readers */}
            <span
              aria-live="polite"
              aria-atomic="true"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
              }}
            >
              Zoom {zoom}%
            </span>
          </div>

          {/* ── Document viewer ── */}
          <div
            style={{
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',  // smooth momentum scroll on iOS
              touchAction: 'pan-x pan-y',         // lets stylus drag to scroll
              background: 'var(--color-surface-raised)',
              borderRadius: 16,
              padding: 8,
              marginBottom: 12,
              maxHeight: '65vh',                  // constrain height so it actually scrolls
              cursor: 'grab',
            }}
          >
            {isPdf && fileUrl ? (
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                loading={
                  <p style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                    Loading document…
                  </p>
                }
                error={
                  <p style={{ textAlign: 'center', padding: 32, color: 'var(--color-danger)' }}>
                    Could not load this PDF.
                  </p>
                }
              >
                {Array.from({ length: numPages ?? 0 }, (_, i) => (
                  <div key={`page_${i + 1}`} style={{ marginBottom: 8 }}>
                    <Page
                      pageNumber={i + 1}
                      scale={zoom / 100}
                    />
                  </div>
                ))}
              </Document>
            ) : fileUrl ? (
              /* Image documents */
              <img
                src={fileUrl}
                alt={file.name}
                style={{
                  width: `${zoom}%`,
                  height: 'auto',
                  display: 'block',
                  borderRadius: 8,
                }}
              />
            ) : null}
          </div>

          <button
            onClick={() => setShowDocument(false)}
            aria-label="Hide document, return to summary"
            style={{
              ...BTN,
              width: '100%',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 18,
              border: '2px solid var(--color-border)',
            }}
          >
            Hide document
          </button>
        </>
      )}
    </div>
  )
}
