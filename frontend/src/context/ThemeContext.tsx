import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// ── Theme registry ─────────────────────────────────────────────────────────────

export interface Theme {
  id: string
  name: string
  emoji: string
  description: string
  preview: { bg: string; surface: string; text: string; accent: string }
}

export const THEMES: Theme[] = [
  {
    id: 'warm-dark',
    name: 'Warm Dark',
    emoji: '🌙',
    description: 'Cozy and easy on the eyes at night',
    preview: { bg: '#1a1714', surface: '#242019', text: '#f5f0e8', accent: '#e8a045' },
  },
  {
    id: 'warm-light',
    name: 'Warm Light',
    emoji: '☀️',
    description: 'Cream and bright for daytime reading',
    preview: { bg: '#faf7f2', surface: '#f0ece3', text: '#1c1814', accent: '#7d3010' },
  },
  {
    id: 'adaptive',
    name: 'Adaptive',
    emoji: '🔄',
    description: 'Follows your phone\'s light/dark setting automatically',
    preview: { bg: '#faf7f2', surface: '#1a1714', text: '#1c1814', accent: '#e8a045' },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    emoji: '⚡',
    description: 'Maximum contrast — sharpest text for easy reading',
    preview: { bg: '#fffff8', surface: '#f5f5ea', text: '#0a0a04', accent: '#003f8a' },
  },
]

const STORAGE_KEY = 'warmcare_theme'
const DEFAULT_THEME = 'warm-dark'

// ── Context ────────────────────────────────────────────────────────────────────

interface ThemeState {
  themeId: string
  themes: Theme[]
  setTheme: (id: string) => void
}

const ThemeContext = createContext<ThemeState>({
  themeId: DEFAULT_THEME,
  themes: THEMES,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(() => {
    // Read synchronously so first render matches the HTML data-theme attribute
    // (which was set by the inline script in index.html)
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    localStorage.setItem(STORAGE_KEY, themeId)
  }, [themeId])

  const setTheme = (id: string) => {
    if (THEMES.find(t => t.id === id)) setThemeId(id)
  }

  return (
    <ThemeContext.Provider value={{ themeId, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
