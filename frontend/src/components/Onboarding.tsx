/**
 * Onboarding — first-run flow for new warm.care users.
 *
 * Three steps:
 *   1. Welcome — what warm.care is
 *   2. Profile — pick input modality
 *   3. Ready   — confirm account + offer test chat; skip to Home at any point
 *
 * Skippable at any step. Never blocks access to the app.
 * Marks completion via ProfileContext (localStorage + server sync).
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'
import type { AccessProfile } from '../types'
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS, DEFAULT_PROFILE } from '../types'
import { navigate } from '../App'

type Step = 'welcome' | 'profile' | 'ready'

const PROFILE_EMOJIS: Record<AccessProfile, string> = {
  stylus: '✏️',
  voice:  '🎙️',
  switch: '💨',
  gaze:   '👁️',
  touch:  '👆',
}

const ALL_PROFILES: AccessProfile[] = ['stylus', 'voice', 'switch', 'gaze', 'touch']

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem 1.5rem',
    maxWidth: 520,
    margin: '0 auto',
    gap: '1.5rem',
  },
  card: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '2px solid var(--color-border)',
    borderRadius: 24,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  },
  primaryBtn: {
    width: '100%',
    minHeight: 64,
    padding: '0 1.5rem',
    fontSize: '1.15rem',
    fontWeight: 700,
    background: 'var(--color-accent)',
    color: '#fff',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  secondaryBtn: {
    width: '100%',
    minHeight: 64,
    padding: '0 1.5rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text)',
    borderRadius: 16,
    border: '2px solid var(--color-border)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  skipBtn: {
    background: 'none',
    border: 'none',
    padding: '10px 0',
    fontSize: '0.95rem',
    color: 'var(--color-text-muted)',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
    minHeight: 48,
    width: '100%',
  },
  muted: {
    color: 'var(--color-text-muted)',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
    margin: 0,
  },
}

export default function Onboarding() {
  const { user } = useAuth()
  const { completeOnboarding } = useProfile()
  const [step, setStep] = useState<Step>('welcome')
  const [selectedProfile, setSelectedProfile] = useState<AccessProfile>('stylus')

  function finish(goToChat = false) {
    completeOnboarding({
      ...DEFAULT_PROFILE,
      accessProfile: selectedProfile,
      name: user?.name || '',
      ttsEnabled: selectedProfile === 'voice' || selectedProfile === 'gaze' || selectedProfile === 'switch',
    })
    if (goToChat) navigate('/chat')
  }

  if (step === 'welcome') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '0.5rem' }}>⛅</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            Welcome to warm.care
          </h1>
        </div>

        <div style={S.card}>
          <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
            warm.care is your personal AI assistant — built around you, not the other way around.
          </p>
          <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
            Read your email, find a GIF, check your bills, or just chat. Everything stays private.
          </p>
          <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
            It takes about 30 seconds to get set up.
          </p>

          <button style={S.primaryBtn} onClick={() => setStep('profile')} aria-label="Get started">
            Get started →
          </button>
          <button style={S.skipBtn} onClick={() => finish()} aria-label="Skip setup and go to home">
            Skip to home
          </button>
        </div>

        <p style={S.muted}>© 2026 Quantum Moon LLC. All rights reserved.</p>
        <p style={S.muted}><a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy policy</a></p>
      </div>
    )
  }

  if (step === 'profile') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            How do you use your device?
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0', fontSize: '1rem' }}>
            warm.care adapts to you. You can change this any time in Settings.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Input profile"
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {ALL_PROFILES.map(p => {
            const active = selectedProfile === p
            return (
              <button
                key={p}
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedProfile(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 18,
                  border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  background: active ? 'var(--color-surface-raised)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  minHeight: 72,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }} aria-hidden="true">
                  {PROFILE_EMOJIS[p]}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 700,
                    color: active ? 'var(--color-accent)' : 'var(--color-text)',
                  }}>
                    {PROFILE_LABELS[p]}
                    {active && <span style={{ marginLeft: 8, fontSize: 13 }}>✓</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {PROFILE_DESCRIPTIONS[p]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <button style={S.primaryBtn} onClick={() => setStep('ready')} aria-label="Continue">
          Continue →
        </button>
        <button style={S.skipBtn} onClick={() => finish()} aria-label="Skip and go to home">
          Skip to home
        </button>

        <p style={S.muted}>© 2026 Quantum Moon LLC. All rights reserved.</p>
        <p style={S.muted}><a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy policy</a></p>
      </div>
    )
  }

  // step === 'ready'
  const firstName = user?.name?.split(' ')[0] ?? ''
  return (
    <div style={S.page}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: '0.5rem' }}>🎉</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
          {firstName ? `You're all set, ${firstName}!` : "You're all set!"}
        </h1>
      </div>

      <div style={S.card}>
        <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
          Signed in as <strong>{user?.email}</strong>.
        </p>
        <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
          Input profile: <strong>{PROFILE_LABELS[selectedProfile]}</strong>.
          Change it any time in Settings.
        </p>

        <button
          style={S.primaryBtn}
          onClick={() => finish(true)}
          aria-label="Try the chat — send a test message"
        >
          Try the chat →
        </button>
        <button
          style={S.secondaryBtn}
          onClick={() => finish(false)}
          aria-label="Go to home screen"
        >
          Go to home
        </button>
      </div>

      <p style={S.muted}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      <p style={S.muted}><a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy policy</a></p>
    </div>
  )
}
