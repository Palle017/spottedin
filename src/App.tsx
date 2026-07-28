import { useEffect, useState } from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import Feed from './screens/Feed';
import Search from './screens/Search';
import ListingDetail from './screens/ListingDetail';
import SellerProfile from './screens/SellerProfile';
import CreateListing from './screens/CreateListing';
import Login from './screens/Login';
import Checkout from './screens/Checkout';
import Inbox from './screens/Inbox';
import Chat from './screens/Chat';
import ClawPanel from './claw/ClawPanel';
import { getUser, subscribe } from './data/store';

// Routes where the bottom tab bar is hidden — full-screen / transactional flows.
function showBottomNav(pathname: string): boolean {
  if (pathname.startsWith('/listing/')) return false;
  if (pathname.startsWith('/checkout/')) return false;
  if (pathname.startsWith('/chat/')) return false;
  if (pathname === '/login') return false;
  return true;
}

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 2.6l9 7.9v10a1 1 0 0 1-1 1h-5.5v-6.5h-5V21.5H4a1 1 0 0 1-1-1v-10l9-7.9z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6.5h-4V21H5a1 1 0 0 1-1-1v-9z" />
    </svg>
  );
}

function SellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function InboxIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 3.4V17h14V7.4l-7 4.9-7-4.9z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M4 6.5l8 6 8-6" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c0-4.4 3.6-7 8-7s8 2.6 8 7v.5H4v-.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.2c.6-4 3.9-6.4 7.5-6.4s6.9 2.4 7.5 6.4" />
    </svg>
  );
}

function BottomNav() {
  const location = useLocation();
  const [user, setUser] = useState(() => getUser());

  useEffect(() => subscribe(() => setUser(getUser())), []);

  if (!showBottomNav(location.pathname)) return null;

  const profilePath = user ? `/seller/${user.sellerId}` : '/login';
  const isProfileActive = location.pathname.startsWith('/seller/');

  return (
    <nav className="bottom-nav">
      <Link
        to="/"
        className={`bottom-nav__item${location.pathname === '/' ? ' is-active' : ''}`}
      >
        <span className="bottom-nav__icon"><HomeIcon active={location.pathname === '/'} /></span>
        Home
      </Link>
      <Link
        to="/sell"
        className={`bottom-nav__item${location.pathname === '/sell' ? ' is-active' : ''}`}
      >
        <span className="bottom-nav__sell"><SellIcon /></span>
        Sell
      </Link>
      <Link
        to="/inbox"
        className={`bottom-nav__item${location.pathname === '/inbox' ? ' is-active' : ''}`}
      >
        <span className="bottom-nav__icon"><InboxIcon active={location.pathname === '/inbox'} /></span>
        Inbox
      </Link>
      <Link
        to={profilePath}
        className={`bottom-nav__item${isProfileActive ? ' is-active' : ''}`}
      >
        <span className="bottom-nav__icon"><ProfileIcon active={isProfileActive} /></span>
        Profile
      </Link>
    </nav>
  );
}

function AppShell() {
  const location = useLocation();
  const hasNav = showBottomNav(location.pathname);

  return (
    <div className="app-frame">
      <div className={`app-content${hasNav ? '' : ' app-content--no-nav'}`}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/search" element={<Search />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="/sell" element={<CreateListing />} />
          <Route path="/checkout/:id" element={<Checkout />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
      <BottomNav />
      {/* CLAW_MOUNT */}
      <ClawPanel />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <AppShell />
      </div>
    </HashRouter>
  );
}
