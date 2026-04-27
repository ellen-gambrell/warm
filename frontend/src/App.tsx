import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { SupporterAuthProvider, useSupporterAuth } from './context/SupporterAuthContext'
import { ThemeProvider } from './context/ThemeContext'
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
import SupporterLogin, { SupporterAcceptInvite } from './components/SupporterLogin'
import SupporterDashboard from './components/SupporterDashboard'
import MenuView from './components/MenuView'

/** SPA navigation without a full page reload. */
export function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// ── Supporter portal shell ────────────────────────────────────────────────────

function SupporterShell({ path, search }: { path: string; search: string }) {
  const { supporter, isLoading } = useSupporterAuth()

  // Invite acceptance
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

  // ── Supporter portal: /supporter/* routes bypass Margaret's auth entirely ──
  if (path.startsWith('/supporter')) {
    return (
      <SupporterAuthProvider>
        <SupporterShell path={path} search={search} />
      </SupporterAuthProvider>
    )
  }

  // Set-password works from an email link — no auth required
  if (path === '/settings/set-password') {
    const token = new URLSearchParams(search).get('token') ?? ''
    return <SetPassword token={token} />
  }

  if (isLoading) return null
  if (!user) return <Login />
  if (!isOnboarded) return <Onboarding />

  if (path === '/menu')       return <MenuView />
  if (path === '/chat')       return <ChatView />
  if (path === '/gif')        return <GifView />
  if (path === '/money')      return <MoneyView />
  if (path === '/drive')      return <Drive />
  if (path === '/gmail')      return <GmailView />
  if (path === '/settings')   return <Settings />
  if (path === '/check-run')  return <CheckRunView />
  return <Home />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <AppShell />
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
