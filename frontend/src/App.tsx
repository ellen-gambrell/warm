import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Home from './components/Home'

function AppShell() {
  const { user, isLoading } = useAuth()
  const { isOnboarded } = useProfile()

  if (isLoading) return null
  if (!user) return <Login />
  return isOnboarded ? <Home /> : <Onboarding />
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <AppShell />
      </ProfileProvider>
    </AuthProvider>
  )
}
