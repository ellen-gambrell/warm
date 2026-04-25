import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { UserProfile } from '../types'
import { DEFAULT_PROFILE } from '../types'

interface ProfileContextValue {
  profile: UserProfile
  setProfile: (p: UserProfile) => void
  isOnboarded: boolean
  completeOnboarding: (p: UserProfile) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

const STORAGE_KEY = 'warm_profile'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE)
  const [isOnboarded, setIsOnboarded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setProfileState(parsed)
        setIsOnboarded(true)
      } catch {
        // corrupted storage — start fresh
      }
    }
  }, [])

  function setProfile(p: UserProfile) {
    setProfileState(p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  }

  function completeOnboarding(p: UserProfile) {
    setProfile(p)
    setIsOnboarded(true)
  }

  return (
    <ProfileContext.Provider value={{ profile, setProfile, isOnboarded, completeOnboarding }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
