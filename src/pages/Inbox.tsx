import { useState } from 'react'
import { SlidersHorizontal, Bell } from 'lucide-react'
import Chip from '../components/Chip'
import './inbox.css'

const FILTERS = ['All', 'Messages', 'Selling', 'Buying'] as const

export default function Inbox() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All')

  return (
    <div className="inbox-page">
      <header className="inbox-header">
        <span className="inbox-header-spacer" aria-hidden="true" />
        <h1 className="inbox-title">Inbox</h1>
        <div className="inbox-header-actions pill">
          <button type="button" className="icon-btn" aria-label="Filter">
            <SlidersHorizontal size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label="Notifications">
            <Bell size={20} />
          </button>
        </div>
      </header>

      <div className="inbox-chip-row">
        {FILTERS.map((filter) => (
          <Chip
            key={filter}
            label={filter}
            selected={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
          />
        ))}
      </div>

      <div className="inbox-empty">
        <div className="inbox-empty-icon-wrap">
          <div className="inbox-empty-square">
            <svg width="40" height="36" viewBox="0 0 40 36" fill="none" aria-hidden="true">
              <rect x="5" y="4" width="30" height="20" rx="8" fill="#fff" />
              <path d="M12 24 L12 33 L22 24 Z" fill="#fff" />
            </svg>
          </div>
          <span className="inbox-empty-badge">0</span>
        </div>
        <div className="inbox-empty-shadow" aria-hidden="true" />
        <p className="inbox-empty-text">No messages yet.</p>
      </div>
    </div>
  )
}
