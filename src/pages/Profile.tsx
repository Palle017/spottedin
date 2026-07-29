import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Menu, Star, BarChart2, SlidersHorizontal, X } from 'lucide-react'
import { user } from '../data/mock'
import './profile.css'

const TABS = ['Shop', 'Sold', 'Purchases', 'Likes'] as const
type Tab = (typeof TABS)[number]

export default function Profile() {
  const [activeTab, setActiveTab] = useState<Tab>('Shop')
  const [showPromo, setShowPromo] = useState(true)

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-spacer" />
        <h1 className="profile-title">{user.handle}</h1>
        <div className="profile-header-actions pill">
          <button type="button" className="icon-btn" aria-label="Add listing">
            <Plus size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label="Menu">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <nav className="profile-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={'profile-tab' + (activeTab === tab ? ' active' : '')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="profile-body">
        <div className="profile-summary">
          <div className="profile-avatar">{user.initials}</div>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">followers</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">following</span>
            </div>
            <div className="profile-stat">
              <Star size={20} />
              <span className="profile-stat-label">no reviews</span>
            </div>
          </div>
        </div>

        <button type="button" className="profile-earnings pill">
          <BarChart2 size={18} />
          <span>Earnings</span>
        </button>

        {showPromo && (
          <div className="profile-promo">
            <button
              type="button"
              className="profile-promo-close"
              aria-label="Dismiss"
              onClick={() => setShowPromo(false)}
            >
              <X size={16} />
            </button>
            <div className="profile-promo-image">
              <img src="https://picsum.photos/seed/spotted-flatlay/400/500" alt="" />
            </div>
            <div className="profile-promo-text">
              <p className="profile-promo-bold">Represent Spotted on Campus</p>
              <p>Become a Spotted Campus Manager</p>
              <p className="profile-promo-bold">Apply today</p>
            </div>
          </div>
        )}

        <div className="profile-active-row">
          <div className="profile-active-heading">
            <span className="profile-active-title">Active</span>
            <span className="profile-active-count">(0 listings)</span>
          </div>
          <button type="button" className="profile-filter-btn" aria-label="Filter listings">
            <SlidersHorizontal size={18} />
          </button>
        </div>

        <div className="profile-empty">
          <ClothesRack />
          <h3 className="profile-empty-title">No active listings</h3>
          <p className="profile-empty-copy">List an item so buyers can discover your shop.</p>
          <Link to="/sell" className="btn btn-primary profile-empty-btn">
            Start selling
          </Link>
        </div>
      </div>
    </div>
  )
}

function ClothesRack() {
  return (
    <svg
      className="profile-rack"
      viewBox="0 0 200 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* top rail */}
      <line x1="20" y1="34" x2="180" y2="34" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      {/* legs */}
      <line x1="24" y1="34" x2="24" y2="166" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      <line x1="176" y1="34" x2="176" y2="166" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      {/* feet */}
      <line x1="6" y1="166" x2="42" y2="166" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      <line x1="158" y1="166" x2="194" y2="166" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      {/* corner braces */}
      <line x1="24" y1="52" x2="52" y2="34" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      <line x1="176" y1="52" x2="148" y2="34" stroke="#b6b6ba" strokeWidth="3" strokeLinecap="round" />
      {/* red clip at rail center */}
      <rect x="93" y="29" width="14" height="10" rx="2" fill="var(--accent)" />
      {/* wooden hanger hook */}
      <path
        d="M100 39 L90 50 L100 55"
        stroke="#b8875a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* wooden hanger body */}
      <path
        d="M100 55 L64 94 L136 94 Z"
        stroke="#b8875a"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}
