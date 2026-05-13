import { useRef, useState, useEffect } from 'react'
import DocumentViewer from './DocumentViewer'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../context/AuthContext'
import { useTrackVisit } from '../hooks/useTrackVisit'
import { navigate } from '../App'

const ACCEPTED = 'application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  webViewLink?: string
}

interface DriveFileSynopsis {
  synopsis: string
  filename: string
}

function driveFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType === 'application/vnd.google-apps.document') return '📝'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return '📊'
  if (mimeType === 'application/vnd.google-apps.presentation') return '📑'
  return '📄'
}

function formatModifiedDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
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
}

export default function Drive() {
  useTrackVisit('drive')
  const { user } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')

  // Google Drive state
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveNotConnected, setDriveNotConnected] = useState(false)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [activeSynopsisId, setActiveSynopsisId] = useState<string | null>(null)
  const [synopses, setSynopses] = useState<Record<string, DriveFileSynopsis | null>>({})
  const [synopsisLoading, setSynopsisLoading] = useState<Record<string, boolean>>({})

  const loadDriveFiles = async (cancelled: { current: boolean }) => {
    setDriveError(null)
    setDriveLoading(true)
    try {
      const filesRes = await fetch('/api/drive/files', { credentials: 'include' })
      if (!filesRes.ok) throw new Error(`Drive returned ${filesRes.status}`)
      const data = await filesRes.json()
      if (!cancelled.current) setDriveFiles(data.files || [])
    } catch {
      if (!cancelled.current) setDriveError('Could not load your Drive files. Check your connection and try again.')
    } finally {
      if (!cancelled.current) setDriveLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const cancelled = { current: false }

    async function checkAndLoad() {
      try {
        const res = await fetch('/api/connections/status', { credentials: 'include' })
        if (!res.ok) return
        const status = await res.json()
        if (!status.drive) {
          if (!cancelled.current) setDriveNotConnected(true)
          return
        }
        if (!cancelled.current) setDriveConnected(true)
        await loadDriveFiles(cancelled)
      } catch {
        if (!cancelled.current) setDriveError('Could not check Google Drive connection.')
        if (!cancelled.current) setDriveLoading(false)
      }
    }

    checkAndLoad()
    return () => { cancelled.current = true }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileSynopsis(file: DriveFile) {
    if (activeSynopsisId === file.id) {
      setActiveSynopsisId(null)
      return
    }
    setActiveSynopsisId(file.id)
    if (synopses[file.id] !== undefined) return

    setSynopsisLoading(prev => ({ ...prev, [file.id]: true }))
    try {
      const res = await fetch(`/api/drive/files/${file.id}/synopsis`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setSynopses(prev => ({ ...prev, [file.id]: null }))
        return
      }
      const data: DriveFileSynopsis = await res.json()
      setSynopses(prev => ({ ...prev, [file.id]: data }))
    } catch {
      setSynopses(prev => ({ ...prev, [file.id]: null }))
    } finally {
      setSynopsisLoading(prev => ({ ...prev, [file.id]: false }))
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setSelectedFile(f)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  function handlePasteSubmit() {
    if (!pasteText.trim()) return
    // Convert pasted text to a plain-text File so DocumentViewer can pass it to the backend
    const name = pasteName.trim() || 'Pasted document.txt'
    const blob = new Blob([pasteText], { type: 'text/plain' })
    const file = new File([blob], name, { type: 'text/plain' })
    setSelectedFile(file)
    setShowPaste(false)
    setPasteText('')
    setPasteName('')
  }

  // When a file is open, show the viewer full-screen
  if (selectedFile) {
    return (
      <DocumentViewer
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
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
          Documents
        </h1>
      </div>

      {/* Open a file */}
      <section
        aria-label="Open a document"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: 24,
          marginBottom: 16,
          border: '2px solid var(--color-border)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Open a document
        </h2>
        <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1.5 }}>
          Open a bill, letter, or any PDF to get an instant plain-language summary — no reading required.
        </p>

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            minHeight: 72,
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 16,
            fontSize: 20,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            fontFamily: 'inherit',
          }}
          aria-label="Choose a PDF or image file"
        >
          📄 Choose a file
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label="Choose PDF or image file"
          tabIndex={-1}
        />
      </section>

      {/* Paste text */}
      <section
        aria-label="Paste document text"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: 24,
          marginBottom: 16,
          border: '2px solid var(--color-border)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Paste text
        </h2>
        <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1.5 }}>
          Got text from an email or website? Paste it here to get a summary.
        </p>

        {!showPaste ? (
          <button
            onClick={() => {
              setShowPaste(true)
              setTimeout(() => pasteRef.current?.focus(), 50)
            }}
            style={{
              width: '100%',
              minHeight: 64,
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 600,
              cursor: 'pointer',
              border: '2px solid var(--color-border)',
              fontFamily: 'inherit',
            }}
            aria-label="Open paste text area"
          >
            📋 Paste text
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label
              htmlFor="paste-name"
              style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}
            >
              Document name (optional)
            </label>
            <input
              id="paste-name"
              type="text"
              value={pasteName}
              onChange={e => setPasteName(e.target.value)}
              placeholder="e.g. Water bill May 2026"
              style={{
                minHeight: 52,
                background: 'var(--color-surface-raised)',
                border: '2px solid var(--color-border)',
                borderRadius: 12,
                color: 'var(--color-text)',
                fontSize: 16,
                padding: '0 16px',
                fontFamily: 'inherit',
              }}
            />

            <label
              htmlFor="paste-text"
              style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}
            >
              Document text
            </label>
            <textarea
              id="paste-text"
              ref={pasteRef}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste the text here…"
              rows={8}
              style={{
                background: 'var(--color-surface-raised)',
                border: '2px solid var(--color-border)',
                borderRadius: 12,
                color: 'var(--color-text)',
                fontSize: 16,
                padding: '12px 16px',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.6,
              }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim()}
                style={{
                  flex: 1,
                  minHeight: 64,
                  background: pasteText.trim() ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: pasteText.trim() ? '#fff' : 'var(--color-text-muted)',
                  borderRadius: 16,
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: pasteText.trim() ? 'pointer' : 'default',
                  border: 'none',
                  fontFamily: 'inherit',
                }}
                aria-label="Summarize pasted text"
              >
                Summarize
              </button>
              <button
                onClick={() => {
                  setShowPaste(false)
                  setPasteText('')
                  setPasteName('')
                }}
                style={{
                  minHeight: 64,
                  minWidth: 64,
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text)',
                  borderRadius: 16,
                  fontSize: 18,
                  cursor: 'pointer',
                  border: '2px solid var(--color-border)',
                  fontFamily: 'inherit',
                }}
                aria-label="Cancel paste"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Google Drive — not connected */}
      {driveNotConnected && (
        <section aria-label="Connect Google Drive" style={{ marginTop: 8, marginBottom: 16 }}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 20,
            padding: 28,
            border: '2px solid var(--color-border)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 18, color: 'var(--color-text)', marginBottom: 20, lineHeight: 1.6 }}>
              Connect Google Drive in Settings to browse and summarize your files here.
            </p>
            <button
              onClick={() => navigate('/settings')}
              aria-label="Go to Settings to connect Google Drive"
              style={{
                minHeight: 56, padding: '0 28px', borderRadius: 14,
                background: 'var(--color-accent)', color: '#fff',
                border: 'none', fontSize: 18, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Go to Settings
            </button>
          </div>
        </section>
      )}

      {/* Google Drive section (only shown when connected) */}
      {driveConnected && (
        <section
          aria-label="From Google Drive"
          style={{ marginTop: 8, marginBottom: 16 }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
            From Google Drive
          </h2>

          {driveLoading && (
            <p aria-live="polite" aria-busy="true" style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>
              Loading your Drive files…
            </p>
          )}

          {!driveLoading && driveError && (
            <div style={{
              background: 'var(--color-surface)', borderRadius: 16, padding: 24,
              border: '2px solid var(--color-border)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
              <p style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--color-text)' }}>{driveError}</p>
              <button
                onClick={() => loadDriveFiles({ current: false })}
                aria-label="Retry loading Drive files"
                style={{
                  minHeight: 48, padding: '0 24px', borderRadius: 12,
                  background: 'var(--color-accent)', color: '#fff',
                  border: 'none', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {!driveLoading && !driveError && driveFiles.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
              No recent files found in your Drive.
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {driveFiles.map(file => (
              <li key={file.id}>
                <button
                  onClick={() => handleFileSynopsis(file)}
                  aria-label={`${file.name}, modified ${formatModifiedDate(file.modifiedTime)}. Tap to summarize.`}
                  aria-expanded={activeSynopsisId === file.id}
                  style={{
                    width: '100%',
                    minHeight: 72,
                    background: 'var(--color-surface)',
                    border: activeSynopsisId === file.id
                      ? '2px solid var(--color-accent)'
                      : '2px solid var(--color-border)',
                    borderRadius: 16,
                    cursor: 'pointer',
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">
                    {driveFileIcon(file.mimeType)}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {formatModifiedDate(file.modifiedTime)}
                    </span>
                  </span>
                </button>

                {/* Synopsis card for this file */}
                {activeSynopsisId === file.id && (
                  <div
                    style={{
                      background: 'var(--color-surface)',
                      borderRadius: '0 0 16px 16px',
                      border: '2px solid var(--color-accent)',
                      borderTop: 'none',
                      padding: 20,
                      marginTop: -4,
                    }}
                  >
                    {synopsisLoading[file.id] && (
                      <p aria-live="polite" aria-busy="true" style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 18 }}>
                        Reading your document…
                      </p>
                    )}

                    {!synopsisLoading[file.id] && synopses[file.id] === null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <p role="alert" style={{ margin: 0, color: 'var(--color-danger)', fontSize: 16 }}>
                          Could not generate a summary for this file.
                        </p>
                        <button
                          onClick={() => {
                            setSynopses(prev => { const n = { ...prev }; delete n[file.id]; return n })
                            handleFileSynopsis(file)
                          }}
                          aria-label="Retry summary"
                          style={{
                            minHeight: 40, padding: '0 16px', borderRadius: 10,
                            background: 'var(--color-surface-raised)',
                            color: 'var(--color-text)', border: '2px solid var(--color-border)',
                            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {!synopsisLoading[file.id] && synopses[file.id] && (
                      <>
                        <div style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--color-text)', marginBottom: 16 }}>
                          <ReactMarkdown components={MD_COMPONENTS}>
                            {synopses[file.id]!.synopsis}
                          </ReactMarkdown>
                        </div>

                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${file.name} in Google Drive`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 52,
                              padding: '0 24px',
                              background: 'var(--color-surface-raised)',
                              color: 'var(--color-accent)',
                              border: '2px solid var(--color-accent)',
                              borderRadius: 12,
                              fontSize: 16,
                              fontWeight: 600,
                              textDecoration: 'none',
                              fontFamily: 'inherit',
                            }}
                          >
                            View in Google Drive ↗
                          </a>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
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
