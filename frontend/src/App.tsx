import { ProfileProvider, useProfile } from './context/ProfileContext'
import Onboarding from './components/Onboarding'
import Home from './components/Home'

function AppShell() {
  const { isOnboarded } = useProfile()
  return isOnboarded ? <Home /> : <Onboarding />
}

export default function App() {
  return (
    <ProfileProvider>
      <AppShell />
    </ProfileProvider>
  )
}
