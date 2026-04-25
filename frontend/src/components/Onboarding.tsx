import { useState } from 'react'
import type { AccessProfile, UserProfile } from '../types'
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS, DEFAULT_PROFILE } from '../types'
import { useProfile } from '../context/ProfileContext'

const PROFILES: AccessProfile[] = ['stylus', 'voice', 'switch', 'gaze', 'touch']

export default function Onboarding() {
  const { completeOnboarding } = useProfile()
  const [selected, setSelected] = useState<AccessProfile>('stylus')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'profile' | 'name'>('profile')

  function handleContinue() {
    if (step === 'profile') {
      setStep('name')
    } else {
      const profile: UserProfile = {
        ...DEFAULT_PROFILE,
        accessProfile: selected,
        name: name.trim() || 'there',
        ttsEnabled: selected === 'voice' || selected === 'gaze' || selected === 'switch',
      }
      completeOnboarding(profile)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 py-10 gap-8"
      style={{ background: 'var(--color-bg)', maxWidth: 640, margin: '0 auto' }}
    >
      <div className="text-center">
        <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          warm.care
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 8, fontSize: 18 }}>
          Your AI assistant, built around you.
        </p>
      </div>

      {step === 'profile' ? (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', textAlign: 'center', margin: 0 }}>
            How do you use your device?
          </h2>
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>
            Choose what fits best. You can change this anytime.
          </p>
          <div className="flex flex-col gap-3 w-full">
            {PROFILES.map((p) => (
              <button
                key={p}
                onClick={() => setSelected(p)}
                aria-pressed={selected === p}
                style={{
                  background: selected === p ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: 'var(--color-text)',
                  borderRadius: 16,
                  padding: '18px 24px',
                  textAlign: 'left',
                  border: selected === p ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: '100%',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 18 }}>{PROFILE_LABELS[p]}</span>
                <span style={{ fontSize: 14, color: selected === p ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}>
                  {PROFILE_DESCRIPTIONS[p]}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', textAlign: 'center', margin: 0 }}>
            What should I call you?
          </h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            autoFocus
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 16,
              padding: '18px 24px',
              color: 'var(--color-text)',
              fontSize: 20,
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </>
      )}

      <button
        onClick={handleContinue}
        style={{
          background: 'var(--color-accent)',
          color: '#fff',
          borderRadius: 16,
          padding: '18px 48px',
          fontSize: 20,
          fontWeight: 600,
          width: '100%',
          minHeight: 64,
        }}
      >
        {step === 'profile' ? 'Continue' : "Let's go"}
      </button>

      {step === 'name' && (
        <button
          onClick={() => setStep('profile')}
          style={{
            background: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 16,
            padding: '12px 24px',
          }}
        >
          Back
        </button>
      )}
    </div>
  )
}
