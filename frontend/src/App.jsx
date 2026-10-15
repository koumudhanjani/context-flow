import { useAuth } from './context/AuthContext'
import { isFirebaseConfigured } from './lib/firebase'
import LoginScreen, { FullScreenLoader } from './components/LoginScreen'
import SetupNotice from './components/SetupNotice'
import Workspace from './components/Workspace'

export default function App() {
  const { user, loading } = useAuth()

  if (!isFirebaseConfigured) return <SetupNotice />
  if (loading) return <FullScreenLoader />
  if (!user) return <LoginScreen />
  // key forces a clean workspace when a different account signs in
  return <Workspace key={user.uid} />
}

