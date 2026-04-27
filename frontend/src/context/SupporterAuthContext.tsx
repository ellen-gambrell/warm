import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export interface SupporterUser {
  id: string
  name: string
  email: string
  role: string
  role_label: string
}

interface SupporterAuthState {
  supporter: SupporterUser | null
  isLoading: boolean
  login: (profile: SupporterUser) => void
  logout: () => Promise<void>
}

const SupporterAuthContext = createContext<SupporterAuthState>({
  supporter: null,
  isLoading: true,
  login: () => {},
  logout: async () => {},
})

export function SupporterAuthProvider({ children }: { children: ReactNode }) {
  const [supporter, setSupporter] = useState<SupporterUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/supporter/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.id) setSupporter(data)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const login = (profile: SupporterUser) => setSupporter(profile)

  const logout = async () => {
    await fetch('/api/supporter/auth/logout', { method: 'POST', credentials: 'include' })
    setSupporter(null)
  }

  return (
    <SupporterAuthContext.Provider value={{ supporter, isLoading, login, logout }}>
      {children}
    </SupporterAuthContext.Provider>
  )
}

export function useSupporterAuth() {
  return useContext(SupporterAuthContext)
}
