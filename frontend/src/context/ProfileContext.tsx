import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { UserProfile } from '../types'
import { DEFAULT_PROFILE } from '../types'
import { useAuth } from './AuthContext'

interface ProfileContextValue {
  profile: UserProfile
  setProfile: (p: UserProfile) => void
  isOnboarded: boolean
  completeOnboarding: (p: UserProfile) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

function storageKey(userId: string | undefined): string {
  // Keyed by user ID so two users on the same browser never share preferences.
  return userId ? `warm_profile_${userId}` : 'warm_profile_anon'
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id

  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE)
  const [isOnboarded, setIsOnboarded] = useState(false)

  // Re-load whenever the logged-in user changes (e.g. Ellen → Margaret on same browser).
  useEffect(() => {
    const key = storageKey(userId)
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        setProfileState(JSON.parse(stored))
        setIsOnboarded(true)
      } catch {
        // Corrupted storage — start fresh for this user.
        setProfileState(DEFAULT_PROFILE)
        setIsOnboarded(false)
      }
    } else {
      // No profile for this user yet — send them through onboarding.
      setProfileState(DEFAULT_PROFILE)
      setIsOnboarded(false)
    }
  }, [userId])

  // Apply font size preference to <html> so CSS variables scale via data-font-size.
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', profile.fontSize)
  }, [profile.fontSize])

  // Apply input profile as a data attribute for future CSS targeting
  useEffect(() => {
    document.documentElement.setAttribute('data-input-profile', profile.accessProfile)
  }, [profile.accessProfile])

  function setProfile(p: UserProfile) {
    setProfileState(p)
    localStorage.setItem(storageKey(userId), JSON.stringify(p))
    // Sync input profile to server (fire-and-forget)
    fetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ input_profile: p.accessProfile }),
    }).catch(() => {})
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
