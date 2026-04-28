/**
 * ConfirmationPanel — shown before any AI action executes.
 *
 * Hard constraint (CLAUDE.md): no AI action is EVER auto-executed.
 * This panel must be confirmed by the user before anything happens.
 *
 * Usage:
 *   {pendingAction && (
 *     <ConfirmationPanel
 *       action={pendingAction}
 *       onConfirm={executeAction}
 *       onCancel={cancelAction}
 *       busy={actionBusy}
 *     />
 *   )}
 */

export interface PendingAction {
  type: string
  label: string
  description: string
  params: Record<string, unknown>
}

interface Props {
  action: PendingAction
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function ConfirmationPanel({ action, onConfirm, onCancel, busy = false }: Props) {
  return (
    <>
      {/* Backdrop — tap to cancel */}
      <div
        onClick={onCancel}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 200,
        }}
      />

      {/* Bottom-sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-panel-title"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          background: 'var(--color-bg)',
          borderTop: '2px solid var(--color-border)',
          borderRadius: '28px 28px 0 0',
          padding: '28px 20px 44px',
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            margin: '0 0 6px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Before I do this…
        </p>

        {/* Title */}
        <h2
          id="confirm-panel-title"
          style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}
        >
          {action.label}
        </h2>

        {/* Action-specific detail */}
        {action.type === 'compose_email' && <EmailDetails params={action.params} />}
        {action.type === 'send_reply'    && <ReplyDetails params={action.params} />}

        {/* Generic fallback */}
        {action.type !== 'compose_email' && action.type !== 'send_reply' && (
          <p style={{ margin: '0 0 16px', fontSize: 17, color: 'var(--color-text)', lineHeight: 1.5 }}>
            {action.description}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel — do nothing"
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 18,
              border: '2px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label={`Confirm: ${action.label}`}
            style={{
              flex: 2,
              minHeight: 64,
              borderRadius: 18,
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {busy ? 'Working…' : '✓ Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Email detail view ──────────────────────────────────────────────────────────

function EmailDetails({ params }: { params: Record<string, unknown> }) {
  const to_name  = (params.to_name  as string) || ''
  const to_email = (params.to_email as string) || ''
  const subject  = (params.subject  as string) || ''
  const body     = (params.body     as string) || ''

  const toLine = to_email ? `${to_name} <${to_email}>` : to_name

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DetailRow label="To"      value={toLine} />
      <DetailRow label="Subject" value={subject} />

      <div>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Message
        </p>
        <div
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 14,
            padding: '14px 16px',
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
            maxHeight: 220,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {body}
        </div>
      </div>
    </div>
  )
}

// ── Reply detail view ──────────────────────────────────────────────────────────

function ReplyDetails({ params }: { params: Record<string, unknown> }) {
  const to      = (params.to      as string) || ''
  const body    = (params.body    as string) || ''
  const preview = body.length > 120 ? body.slice(0, 120).trimEnd() + '…' : body

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DetailRow label="To" value={to} />
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Message
        </p>
        <div
          style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: 14,
            padding: '14px 16px',
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {preview}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          minWidth: 60,
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 16, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}
