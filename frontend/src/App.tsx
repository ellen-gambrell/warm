import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { SupporterAuthProvider, useSupporterAuth } from './context/SupporterAuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { NavProvider, _navPush } from './context/NavContext'
import { ReminderProvider, useReminders } from './context/ReminderContext'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import Drive from './components/Drive'
import Settings from './components/Settings'
import GmailView from './components/GmailView'
import ChatView from './components/ChatView'
import GifView from './components/GifView'
import MoneyView from './components/MoneyView'
import SetPassword from './components/SetPassword'
import CheckRunView from './components/CheckRunView'
import RemindersView from './components/RemindersView'
import SupporterLogin, { SupporterAcceptInvite } from './components/SupporterLogin'
import SupporterDashboard from './components/SupporterDashboard'
import MenuView from './components/MenuView'
import NavBar from './components/NavBar'
import AdminPanel from './components/AdminPanel'
import BillsView from './components/BillsView'
import Privacy from './components/Privacy'
import ProfileView from './components/ProfileView'

/**
 * SPA navigation — pushes to browser history AND updates the NavContext stack
 * so Back/Forward buttons have deterministic disabled state.
 */
export function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  _navPush(path) // updates NavContext stack (no-op if context not mounted)
}

// ── Reminder alert banner ─────────────────────────────────────────────────────

function ReminderAlertBanner() {
  const { activeAlert, dismissAlert } = useReminders()
  if (!activeAlert) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 9999,
        background: 'var(--color-accent)',
        color: '#000',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      <span style={{ fontSize: 28 }} aria-hidden="true">⏰</span>
      <span style={{ flex: 1, fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{activeAlert}</span>
      <button
        onClick={dismissAlert}
        aria-label="Dismiss reminder"
        style={{
          background: 'rgba(0,0,0,0.15)',
          border: 'none',
          borderRadius: 12,
          color: '#000',
          fontSize: 'var(--fs-md)',
          fontWeight: 700,
          minHeight: 52,
          minWidth: 64,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '0 16px',
        }}
      >
        Done
      </button>
    </div>
  )
}

// ── Supporter portal shell ────────────────────────────────────────────────────

function SupporterShell({ path, search }: { path: string; search: string }) {
  const { supporter, isLoading } = useSupporterAuth()

  if (path === '/supporter/accept') {
    const token = new URLSearchParams(search).get('token') ?? ''
    return <SupporterAcceptInvite token={token} />
  }

  if (isLoading) return null
  if (!supporter) return <SupporterLogin />
  return <SupporterDashboard />
}

// ── Margaret's app shell ──────────────────────────────────────────────────────

function AppShell() {
  const { user, isLoading } = useAuth()
  const { isOnboarded } = useProfile()
  const [path, setPath] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ── Supporter portal: /supporter/* routes bypass Margaret's auth and NavBar ──
  if (path.startsWith('/supporter')) {
    return (
      <SupporterAuthProvider>
        <SupporterShell path={path} search={search} />
      </SupporterAuthProvider>
    )
  }

  // Set-password works from an email link — no auth required, no NavBar
  if (path === '/settings/set-password') {
    const token = new URLSearchParams(search).get('token') ?? ''
    return <SetPassword token={token} />
  }

  // Privacy policy — public, no auth required
  if (path === '/privacy') return <Privacy />

  if (isLoading) return null
  if (!user) return <Login />
  if (!isOnboarded) return <Onboarding />

  // ── Authenticated screens — NavBar always rendered above the view ──
  let view: React.ReactNode
  if (path === '/admin')           view = <AdminPanel />
  else if (path === '/profile')    view = <ProfileView />
  else if (path === '/menu')       view = <MenuView />
  else if (path === '/chat')       view = <ChatView />
  else if (path === '/gif')        view = <GifView />
  else if (path === '/money')      view = <MoneyView />
  else if (path === '/drive')      view = <Drive />
  else if (path === '/gmail')      view = <GmailView />
  else if (path === '/bills')      view = <BillsView />
  else if (path === '/settings')   view = <Settings />
  else if (path === '/check-run')  view = <CheckRunView />
  else if (path === '/reminders')  view = <RemindersView />
  else view = <Home />

  return (
    <>
      <ReminderAlertBanner />
      <NavBar />
      {view}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <ReminderProvider>
            <NavProvider>
              <AppShell />
            </NavProvider>
          </ReminderProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
