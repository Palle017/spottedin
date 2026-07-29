import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Discover from './pages/Discover'
import Sell from './pages/Sell'
import Inbox from './pages/Inbox'
import Profile from './pages/Profile'
import Sizes from './pages/onboarding/Sizes'
import Brands from './pages/onboarding/Brands'

const ONBOARDED_KEY = 'spotted_onboarded'

function HomeGate() {
  const onboarded = localStorage.getItem(ONBOARDED_KEY)
  if (!onboarded) {
    return <Navigate to="/onboarding/sizes" replace />
  }
  return <Home />
}

function AppShell() {
  const location = useLocation()
  const hideNav = location.pathname === '/sell' || location.pathname.startsWith('/onboarding')

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomeGate />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/onboarding/sizes" element={<Sizes />} />
        <Route path="/onboarding/brands" element={<Brands />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
