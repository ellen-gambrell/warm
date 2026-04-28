/**
 * NavContext — deterministic in-app navigation stack.
 *
 * Maintains an explicit stack + cursor so Back/Forward disabled state
 * is always computed from our own state, never inferred from window.history.
 *
 * Usage (components):
 *   const { back, forward, canBack, canForward } = useNav()
 *
 * Usage (module-level navigate shim in App.tsx):
 *   Call _navPush(path) after window.history.pushState so the stack tracks
 *   every in-app navigation.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ── Module-level bridge ──────────────────────────────────────────────────────
// Allows the App.tsx navigate() export to push to the context without
// requiring every call site to hold a React reference.

let _pushFn: ((path: string) => void) | null = null

export function _navPush(path: string): void {
  _pushFn?.(path)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavContextValue {
  back: () => void
  forward: () => void
  canBack: boolean
  canForward: boolean
}

const NavContext = createContext<NavContextValue>({
  back: () => {},
  forward: () => {},
  canBack: false,
  canForward: false,
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<string[]>([window.location.pathname])
  const [cursor, setCursor] = useState(0)

  // Refs for stable access inside callbacks without stale closures
  const stackRef = useRef(stack)
  const cursorRef = useRef(cursor)

  useEffect(() => { stackRef.current = stack }, [stack])
  useEffect(() => { cursorRef.current = cursor }, [cursor])

  // push — called by the navigate() shim in App.tsx
  const push = useCallback((path: string) => {
    const cur = cursorRef.current
    const stk = stackRef.current
    // Truncate any forward history, then append
    const newStack = [...stk.slice(0, cur + 1), path]
    const newCursor = newStack.length - 1
    stackRef.current = newStack
    cursorRef.current = newCursor
    setStack(newStack)
    setCursor(newCursor)
  }, [])

  // Register push with the module-level bridge
  useEffect(() => {
    _pushFn = push
    return () => { _pushFn = null }
  }, [push])

  const back = useCallback(() => {
    const cur = cursorRef.current
    if (cur <= 0) return
    const prevPath = stackRef.current[cur - 1]
    cursorRef.current = cur - 1
    setCursor(cur - 1)
    window.history.pushState(null, '', prevPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const forward = useCallback(() => {
    const cur = cursorRef.current
    const stk = stackRef.current
    if (cur >= stk.length - 1) return
    const nextPath = stk[cur + 1]
    cursorRef.current = cur + 1
    setCursor(cur + 1)
    window.history.pushState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const canBack = cursor > 0
  const canForward = cursor < stack.length - 1

  return (
    <NavContext.Provider value={{ back, forward, canBack, canForward }}>
      {children}
    </NavContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNav() {
  return useContext(NavContext)
}
