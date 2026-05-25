/**
 * ProfileView — /profile
 *
 * Lets the user edit their display name, pronouns, input profile, and profile emoji.
 * Email is read-only (managed by Google).
 */

import { useEffect, useRef, useState } from 'react'
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

// ── Emoji data ────────────────────────────────────────────────────────────────

const EMOJI_DATA: { emoji: string; name: string; keywords: string[] }[] = [
  // Faces
  { emoji: '🙂', name: 'slightly smiling face', keywords: ['smile', 'happy', 'default'] },
  { emoji: '😊', name: 'smiling face', keywords: ['happy', 'warm', 'friendly'] },
  { emoji: '😄', name: 'grinning face', keywords: ['laugh', 'big smile', 'joy'] },
  { emoji: '😎', name: 'cool', keywords: ['sunglasses', 'confident', 'chill'] },
  { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'adore', 'affection'] },
  { emoji: '😌', name: 'relieved face', keywords: ['calm', 'peaceful', 'content'] },
  { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'warm', 'embrace'] },
  { emoji: '😏', name: 'smirking face', keywords: ['smirk', 'knowing', 'sly'] },
  { emoji: '🤔', name: 'thinking face', keywords: ['think', 'wonder', 'curious'] },
  { emoji: '😇', name: 'smiling face with halo', keywords: ['angel', 'innocent', 'good'] },
  { emoji: '🙃', name: 'upside-down face', keywords: ['silly', 'playful', 'funny'] },
  { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'funny', 'lol'] },

  // Hearts
  { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', 'red'] },
  { emoji: '🧡', name: 'orange heart', keywords: ['love', 'heart', 'orange', 'warm'] },
  { emoji: '💛', name: 'yellow heart', keywords: ['love', 'heart', 'yellow', 'happy'] },
  { emoji: '💚', name: 'green heart', keywords: ['love', 'heart', 'green', 'nature'] },
  { emoji: '💙', name: 'blue heart', keywords: ['love', 'heart', 'blue', 'calm'] },
  { emoji: '💜', name: 'purple heart', keywords: ['love', 'heart', 'purple'] },
  { emoji: '🖤', name: 'black heart', keywords: ['love', 'heart', 'black', 'dark'] },
  { emoji: '🤍', name: 'white heart', keywords: ['love', 'heart', 'white', 'pure'] },
  { emoji: '💕', name: 'two hearts', keywords: ['love', 'affection', 'couple'] },
  { emoji: '💖', name: 'sparkling heart', keywords: ['love', 'sparkle', 'glitter'] },

  // Nature
  { emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring', 'pink', 'japan'] },
  { emoji: '🌺', name: 'hibiscus', keywords: ['flower', 'tropical', 'red'] },
  { emoji: '🌻', name: 'sunflower', keywords: ['flower', 'sun', 'yellow', 'summer'] },
  { emoji: '🌹', name: 'rose', keywords: ['flower', 'romance', 'red'] },
  { emoji: '🍀', name: 'four leaf clover', keywords: ['lucky', 'green', 'shamrock'] },
  { emoji: '🌿', name: 'herb', keywords: ['plant', 'green', 'nature', 'leaf'] },
  { emoji: '🌙', name: 'crescent moon', keywords: ['moon', 'night', 'sky'] },
  { emoji: '⭐', name: 'star', keywords: ['star', 'sky', 'bright'] },
  { emoji: '🌟', name: 'glowing star', keywords: ['star', 'shine', 'bright', 'sparkle'] },
  { emoji: '☀️', name: 'sun', keywords: ['sun', 'sunny', 'warm', 'day'] },
  { emoji: '🌈', name: 'rainbow', keywords: ['rainbow', 'colorful', 'pride', 'hope'] },
  { emoji: '🌊', name: 'wave', keywords: ['ocean', 'water', 'sea', 'wave'] },
  { emoji: '🏔️', name: 'mountain', keywords: ['mountain', 'peak', 'nature', 'high'] },
  { emoji: '🌴', name: 'palm tree', keywords: ['tree', 'tropical', 'beach', 'summer'] },
  { emoji: '🍂', name: 'fallen leaf', keywords: ['autumn', 'fall', 'leaf', 'orange'] },
  { emoji: '❄️', name: 'snowflake', keywords: ['snow', 'winter', 'cold', 'ice'] },

  // Animals
  { emoji: '🐱', name: 'cat', keywords: ['cat', 'pet', 'kitty', 'animal'] },
  { emoji: '🐶', name: 'dog', keywords: ['dog', 'pet', 'puppy', 'animal'] },
  { emoji: '🦋', name: 'butterfly', keywords: ['butterfly', 'nature', 'transform', 'beautiful'] },
  { emoji: '🐝', name: 'bee', keywords: ['bee', 'honey', 'busy', 'insect'] },
  { emoji: '🦊', name: 'fox', keywords: ['fox', 'clever', 'orange', 'animal'] },
  { emoji: '🐢', name: 'turtle', keywords: ['turtle', 'slow', 'shell', 'reptile'] },
  { emoji: '🦁', name: 'lion', keywords: ['lion', 'brave', 'king', 'animal'] },
  { emoji: '🐧', name: 'penguin', keywords: ['penguin', 'bird', 'cute', 'cold'] },
  { emoji: '🦅', name: 'eagle', keywords: ['eagle', 'bird', 'freedom', 'strong'] },
  { emoji: '🐬', name: 'dolphin', keywords: ['dolphin', 'ocean', 'smart', 'swim'] },
  { emoji: '🦄', name: 'unicorn', keywords: ['unicorn', 'magic', 'fantasy', 'horse'] },
  { emoji: '🐨', name: 'koala', keywords: ['koala', 'cute', 'bear', 'australia'] },

  // Activities & hobbies
  { emoji: '📚', name: 'books', keywords: ['books', 'read', 'learn', 'study'] },
  { emoji: '🎵', name: 'music note', keywords: ['music', 'song', 'melody', 'note'] },
  { emoji: '🎨', name: 'artist palette', keywords: ['art', 'paint', 'creative', 'color'] },
  { emoji: '✏️', name: 'pencil', keywords: ['write', 'draw', 'pencil', 'school'] },
  { emoji: '🧩', name: 'puzzle', keywords: ['puzzle', 'game', 'solve', 'think'] },
  { emoji: '🎯', name: 'bullseye', keywords: ['target', 'goal', 'aim', 'focus'] },
  { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'award', 'champion'] },
  { emoji: '⚽', name: 'soccer ball', keywords: ['soccer', 'football', 'sport', 'ball'] },
  { emoji: '🎸', name: 'guitar', keywords: ['guitar', 'music', 'rock', 'instrument'] },
  { emoji: '🌐', name: 'globe', keywords: ['world', 'earth', 'global', 'internet'] },

  // Food & drink
  { emoji: '🍎', name: 'apple', keywords: ['apple', 'fruit', 'red', 'healthy'] },
  { emoji: '🍓', name: 'strawberry', keywords: ['strawberry', 'fruit', 'red', 'sweet'] },
  { emoji: '🫐', name: 'blueberry', keywords: ['blueberry', 'fruit', 'blue', 'small'] },
  { emoji: '🍋', name: 'lemon', keywords: ['lemon', 'citrus', 'yellow', 'sour'] },
  { emoji: '🥝', name: 'kiwi', keywords: ['kiwi', 'fruit', 'green', 'tropical'] },
  { emoji: '☕', name: 'coffee', keywords: ['coffee', 'hot', 'morning', 'cafe'] },
  { emoji: '🍵', name: 'tea', keywords: ['tea', 'hot', 'drink', 'cup'] },
  { emoji: '🧁', name: 'cupcake', keywords: ['cupcake', 'cake', 'sweet', 'bake'] },
  { emoji: '🍪', name: 'cookie', keywords: ['cookie', 'sweet', 'bake', 'treat'] },
  { emoji: '🍕', name: 'pizza', keywords: ['pizza', 'food', 'italian', 'slice'] },

  // Objects & symbols
  { emoji: '💎', name: 'gem', keywords: ['gem', 'diamond', 'jewel', 'precious'] },
  { emoji: '🔑', name: 'key', keywords: ['key', 'lock', 'open', 'access'] },
  { emoji: '🏠', name: 'house', keywords: ['home', 'house', 'building', 'family'] },
  { emoji: '⚡', name: 'lightning', keywords: ['lightning', 'electric', 'fast', 'energy'] },
  { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'flame', 'energy'] },
  { emoji: '💡', name: 'light bulb', keywords: ['idea', 'bright', 'think', 'light'] },
  { emoji: '🎁', name: 'gift', keywords: ['gift', 'present', 'birthday', 'surprise'] },
  { emoji: '🎶', name: 'musical notes', keywords: ['music', 'song', 'notes', 'melody'] },
  { emoji: '💫', name: 'dizzy star', keywords: ['star', 'sparkle', 'magic', 'dizzy'] },
  { emoji: '🌺', name: 'flower', keywords: ['flower', 'bloom', 'beautiful', 'tropical'] },
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

  const googleName = user?.name ?? ''
  const googleParts = googleName.trim().split(/\s+/)
  const googleFirst = googleParts[0] ?? ''
  const googleLast = googleParts.slice(1).join(' ')

  const [firstName, setFirstName] = useState(user?.first_name ?? googleFirst)
  const [lastName, setLastName] = useState(user?.last_name ?? googleLast)
  const [pronouns, setPronouns] = useState(user?.pronouns ?? '')
  const [pronounsChanged, setPronounsChanged] = useState(false)
  const [emoji, setEmoji] = useState(user?.profile_emoji ?? '🙂')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search input when picker opens
  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
  }, [pickerOpen])

  // Close picker on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    if (pickerOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen])

  const filteredEmojis = emojiSearch.trim()
    ? EMOJI_DATA.filter(e =>
        e.name.includes(emojiSearch.toLowerCase()) ||
        e.keywords.some(k => k.includes(emojiSearch.toLowerCase()))
      )
    : EMOJI_DATA

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
          // Only send pronouns if the user explicitly changed them this session
          ...(pronounsChanged ? { pronouns: pronouns.trim() || null } : {}),
          input_profile: profile.accessProfile,
          profile_emoji: emoji,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Could not save profile.')
      }
      const updated = await res.json()
      updateUser({
        first_name: updated.first_name,
        last_name: updated.last_name,
        pronouns: updated.pronouns,
        profile_emoji: updated.profile_emoji,
      })
      setSaveState('saved')
      // No setTimeout — state persists until next save (MEDIUM-2: no timed UI)
    } catch {
      setSaveState('error')
      // No setTimeout — error state persists until next save attempt
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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          Profile
        </h1>
      </div>

      {/* ── Emoji icon picker ── */}
      <h2 style={SECTION_HEADING}>Profile icon</h2>

      <div style={{ marginBottom: 8 }}>
        {/* Current emoji button */}
        <button
          onClick={() => { setPickerOpen(o => !o); setEmojiSearch('') }}
          aria-label="Choose profile emoji"
          aria-expanded={pickerOpen}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '2px solid var(--color-border)',
            background: 'var(--color-surface)',
            fontSize: 44,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {emoji}
        </button>

        {/* Picker panel — MEDIUM-5: role="region" (not "dialog" — not modal) + visible close button */}
        {pickerOpen && (
          <div
            role="region"
            aria-label="Emoji picker"
            style={{
              marginTop: 10,
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 16,
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search emoji…"
                aria-label="Search emoji"
                value={emojiSearch}
                onChange={e => setEmojiSearch(e.target.value)}
                style={{
                  ...INPUT_STYLE,
                  flex: 1,
                  minHeight: 44,
                }}
              />
              <button
                onClick={() => { setPickerOpen(false); setEmojiSearch('') }}
                aria-label="Close emoji picker"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  borderRadius: 10,
                  border: '2px solid var(--color-border)',
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text)',
                  fontSize: 18,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >×</button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 4,
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {filteredEmojis.map(item => (
                <button
                  key={item.emoji + item.name}
                  aria-label={item.name}
                  onClick={() => { setEmoji(item.emoji); setPickerOpen(false) }}
                  style={{
                    fontSize: 26,
                    minHeight: 44,
                    minWidth: 44,
                    background: item.emoji === emoji ? 'var(--color-surface-raised, var(--color-border))' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.emoji}
                </button>
              ))}
              {filteredEmojis.length === 0 && (
                <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--color-text-muted)', fontSize: 14 }}>
                  No emoji found. Try a different word.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Name fields ── */}
      <h2 style={SECTION_HEADING}>Name</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
        <div>
          <label htmlFor="profile-first-name" style={LABEL_STYLE}>First name</label>
          <input
            id="profile-first-name"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="profile-last-name" style={LABEL_STYLE}>Last name</label>
          <input
            id="profile-last-name"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="profile-email" style={LABEL_STYLE}>Login email (managed by Google)</label>
          <input
            id="profile-email"
            type="email"
            readOnly
            value={user.email}
            aria-label="Login email, read only"
            style={{ ...INPUT_STYLE, color: 'var(--color-text-muted)', cursor: 'default' }}
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
                background: 'var(--color-surface)',
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
                onChange={() => { setPronouns(opt); setPronounsChanged(true) }}
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
                background: 'var(--color-surface)',
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

      {/* ── Save ── */}
      {saveState === 'error' && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--color-danger)', fontWeight: 600 }}>
          Could not save profile. Please try again.
        </p>
      )}
      {/* MEDIUM-3: visually-hidden live region announces save state to VoiceOver regardless of focus position */}
      <span
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {saveState === 'saved' ? 'Profile saved.' : saveState === 'error' ? 'Could not save profile.' : ''}
      </span>
      <div style={{ position: 'relative' }}>
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
            background: saveState === 'saved' ? '#2d7a2d' : saveState === 'error' ? '#7a2d2d' : 'var(--color-accent)',
            color: '#fff',
            opacity: saveState === 'saving' ? 0.6 : 1,
            marginBottom: 40,
            width: '100%',
          }}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <footer style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 8 }}>
        <p style={{ margin: 0 }}>
          The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
        </p>
        <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
