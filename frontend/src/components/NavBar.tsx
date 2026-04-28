/**
 * NavBar — persistent Back and Forward navigation buttons.
 *
 * Hard constraints (CLAUDE.md / backlog spec):
 * - Both buttons are ALWAYS rendered — never hidden, never collapsed.
 * - Both occupy the same fixed position regardless of availability.
 * - Disabled (not hidden) when action is unavailable.
 * - Minimum 64px tap target.
 * - Sticky at the top of every authenticated screen.
 */

import { useNav } from '../context/NavContext'

export const NAVBAR_HEIGHT = 80 // px — import in any view that needs to subtract it

const BTN_BASE: React.CSSProperties = {
  minHeight: 64,
  minWidth: 80,
  borderRadius: 14,
  border: '2px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 17,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'opacity 0.15s',
  // Ensure the button always occupies the same space whether enabled or disabled
  flexShrink: 0,
}

export default function NavBar() {
  const { back, forward, canBack, canForward } = useNav()

  return (
    <div
      role="navigation"
      aria-label="Page navigation"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: NAVBAR_HEIGHT,
        background: 'var(--color-surface)',
        borderBottom: '2px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        // Cap width to match all view containers
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={back}
        disabled={!canBack}
        aria-label="Go back"
        aria-disabled={!canBack}
        style={{
          ...BTN_BASE,
          color: canBack ? 'var(--color-text)' : 'var(--color-text-muted)',
          opacity: canBack ? 1 : 0.38,
          cursor: canBack ? 'pointer' : 'default',
        }}
      >
        ← Back
      </button>

      <button
        onClick={forward}
        disabled={!canForward}
        aria-label="Go forward"
        aria-disabled={!canForward}
        style={{
          ...BTN_BASE,
          color: canForward ? 'var(--color-text)' : 'var(--color-text-muted)',
          opacity: canForward ? 1 : 0.38,
          cursor: canForward ? 'pointer' : 'default',
        }}
      >
        Forward →
      </button>
    </div>
  )
}
