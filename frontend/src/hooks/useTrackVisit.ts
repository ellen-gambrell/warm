import { useEffect } from 'react'

/**
 * Fire-and-forget visit tracking for usage metrics.
 * Calls POST /api/admin/visit on component mount.
 * Failures are silently swallowed — never block the user.
 */
export function useTrackVisit(feature: string) {
  useEffect(() => {
    fetch('/api/admin/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ feature }),
    }).catch(() => {})
  }, [feature])
}
