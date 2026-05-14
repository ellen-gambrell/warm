/**
 * ProfileView — /profile
 *
 * Lets the user edit their display name, pronouns, and input profile.
 * Email is read-only (managed by Google).
 * Input profile previously lived in Settings; it now lives here.
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'
import type { AccessProfile } from '../types'
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PROFILES: AccessProfile[] = ['stylus', 'voice', 'switch', 'gaze', 'touch']

const PROFILE_EMOJIS: Record<AccessProfile, string> = {
  stylus: '✏️',
  voice: '🎙️',
  switch: '💨',
  gaze: '👁️',
  touch: '👆',
}

const PRONOUNS_OPTIONS = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
  'use my name only',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0 16px',
  minHeight: 56,
  fontSize: 18,
  background: 'var(--color-surface)',
  border: '2px solid var(--color-border)',
  borderRadius: 12,
  color: 'var(--color-text)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: 6,
}

const SECTION_HEADING: React.CSSProperties = {
  margin: '24px 0 14px',
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileView() {
  const { user, updateUser } = useAuth()
  const { profile, setProfile } = useProfile()

  // Derive initial first/last name from stored values or Google name
  const googleName = user?.name ?? ''
  const googleParts = googleName.trim().split(/\s+/)
  const googleFirst = googleParts[0] ?? ''
  const googleLast = googleParts.slice(1).join(' ')

  const [firstName, setFirstName] = useState(user?.first_name ?? googleFirst)
  const [lastName, setLastName] = useState(user?.last_name ?? googleLast)
  const [pronouns, setPronouns] = useState(user?.pronouns ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSave() {
    setSaveState('saving')
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          pronouns: pronouns.trim() || null,
          input_profile: profile.accessProfile,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Could not save profile.')
      }
      const updated = await res.json()
      // Update AuthContext so name reflects immediately without reload
      updateUser({
        first_name: updated.first_name,
        last_name: updated.last_name,
        pronouns: updated.pronouns,
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  if (!user) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '16px',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          Profile
        </h1>
      </div>

      {/* ── Name fields ── */}
      <h2 style={SECTION_HEADING}>Name</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
        {/* First name */}
        <div>
          <label htmlFor="profile-first-name" style={LABEL_STYLE}>
            First name
          </label>
          <input
            id="profile-first-name"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        {/* Last name */}
        <div>
          <label htmlFor="profile-last-name" style={LABEL_STYLE}>
            Last name
          </label>
          <input
            id="profile-last-name"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        {/* Email — read only */}
        <div>
          <label htmlFor="profile-email" style={LABEL_STYLE}>
            Login email (managed by Google)
          </label>
          <input
            id="profile-email"
            type="email"
            readOnly
            value={user.email}
            aria-label="Login email, read only"
            style={{
              ...INPUT_STYLE,
              color: 'var(--color-text-muted)',
              cursor: 'default',
            }}
          />
        </div>
      </div>

      {/* ── Pronouns ── */}
      <h2 style={{ ...SECTION_HEADING, marginTop: 28 }}>Pronouns</h2>

      <div
        role="radiogroup"
        aria-labelledby="pronouns-label"
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}
      >
        <span id="pronouns-label" style={{ ...LABEL_STYLE, marginBottom: 0 }}>
          Select your pronouns
        </span>
        {PRONOUNS_OPTIONS.map(opt => {
          const checked = pronouns === opt
          return (
            <label
              key={opt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderRadius: 18,
                border: checked ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                background: checked ? 'var(--color-surface)' : 'var(--color-surface)',
                cursor: 'pointer',
                minHeight: 64,
                fontFamily: 'inherit',
              }}
            >
              <input
                type="radio"
                name="pronouns"
                value={opt}
                checked={checked}
                onChange={() => setPronouns(opt)}
                style={{ width: 20, height: 20, flexShrink: 0 }}
              />
              <span style={{
                fontSize: 17,
                fontWeight: checked ? 700 : 400,
                color: checked ? 'var(--color-accent)' : 'var(--color-text)',
              }}>
                {opt}
                {checked && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700 }}>✓</span>}
              </span>
            </label>
          )
        })}
      </div>

      {/* ── Input profile ── */}
      <h2 style={{ ...SECTION_HEADING, marginTop: 28 }}>Input Profile</h2>
      <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--color-text-muted)' }}>
        How you control your device. Shapes touch target sizes and navigation.
      </p>

      <div
        role="radiogroup"
        aria-label="Input profile"
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}
      >
        {ALL_PROFILES.map(p => {
          const active = profile.accessProfile === p
          return (
            <button
              key={p}
              role="radio"
              aria-checked={active}
              onClick={() => setProfile({ ...profile, accessProfile: p })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderRadius: 18,
                border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                background: active ? 'var(--color-surface)' : 'var(--color-surface)',
                cursor: 'pointer',
                minHeight: 72,
                fontFamily: 'inherit',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">
                {PROFILE_EMOJIS[p]}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block',
                  fontSize: 17,
                  fontWeight: 700,
                  color: active ? 'var(--color-accent)' : 'var(--color-text)',
                }}>
                  {PROFILE_LABELS[p]}
                  {active && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700 }}>✓</span>}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {PROFILE_DESCRIPTIONS[p]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Save button ── */}
      {saveState === 'error' && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--color-danger)', fontWeight: 600 }}>
          Could not save profile. Please try again.
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={saveState === 'saving'}
        aria-label="Save profile"
        style={{
          minHeight: 64,
          borderRadius: 16,
          border: 'none',
          fontFamily: 'inherit',
          cursor: saveState === 'saving' ? 'default' : 'pointer',
          fontWeight: 700,
          fontSize: 18,
          transition: 'opacity 0.15s',
          background: saveState === 'saved'
            ? '#2d7a2d'
            : saveState === 'error'
              ? '#7a2d2d'
              : 'var(--color-accent)',
          color: '#fff',
          opacity: saveState === 'saving' ? 0.6 : 1,
          marginBottom: 40,
        }}
      >
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
      </button>

      <footer style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 8 }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
