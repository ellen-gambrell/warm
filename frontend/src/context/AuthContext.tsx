/**
 * AuthContext — cookie-based session management
 *
 * Auth model
 * ──────────
 * Session is stored in an HttpOnly, Secure, SameSite=Lax cookie set by the
 * backend. JavaScript never sees the JWT — no localStorage token exposure.
 *
 * On mount: call GET /api/auth/me (cookie sent automatically by browser).
 *   Success → user is signed in; update state.
 *   401     → user is signed out; clear local cache.
 *   Network error → keep cached profile data (don't log out on bad connection).
 *
 * Non-sensitive user data (id, name, email — NO token) is cached in localStorage
 * so the app can render immediately while the server round-trip completes.
 *
 * "Stay signed in": handled by the backend cookie Max-Age.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (profile: AuthUser) => void
  logout: () => void
}

// ── Cache — stores {id, name, email} ONLY — no JWT ────────────────────────────

const CACHE_KEY = 'warmcare_user_cache'

function readCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function writeCache(user: AuthUser): void {
  // Only store non-sensitive display data — never store the JWT here
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }),
  )
}

function clearCache(): void {
  localStorage.removeItem(CACHE_KEY)
  // Also clear old token keys from the previous auth model (migration cleanup)
  localStorage.removeItem('warmcare_user_persistent')
  sessionStorage.removeItem('warmcare_user')
  sessionStorage.removeItem('warmcare_extended_session')
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reVerify = useCallback(async (cached: AuthUser | null) => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const fresh = (await res.json()) as AuthUser
        const updated: AuthUser = { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role ?? 'user' }
        setUser(updated)
        writeCache(updated)
      } else {
        // Server says not authenticated
        clearCache()
        setUser(null)
      }
    } catch {
      // Network error — keep cached user rather than logging them out
      if (!cached) setUser(null)
    }
  }, [])

  useEffect(() => {
    // Show cached profile immediately (no JWT here — safe to cache)
    const cached = readCache()
    if (cached) setUser(cached)

    // Validate session cookie with server in background
    reVerify(cached).finally(() => setIsLoading(false))
  }, [reVerify])

  function login(profile: AuthUser) {
    const user: AuthUser = { id: profile.id, name: profile.name, email: profile.email, role: profile.role ?? 'user' }
    writeCache(user)
    setUser(user)
  }

  function logout() {
    clearCache()
    setUser(null)
    // Clear the server-side HttpOnly cookie
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
