import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import { getFeed, getUser, subscribe } from '../data/store';
import { rankFeed } from '../data/curation';
import type { Category } from '../data/types';

const CHIPS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'sneakers', label: 'Sneakers' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'home', label: 'Home' },
  { key: 'vintage', label: 'Vintage' },
];

export default function Feed() {
  const [active, setActive] = useState<Category | 'all'>('all');
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const user = useMemo(() => getUser(), [tick]);

  const listings = useMemo(() => {
    const feed = getFeed(active === 'all' ? undefined : active);
    return user ? rankFeed(feed, user.sellerId) : feed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tick, user]);

  return (
    <div className="feed">
      <style>{`
        .feed__header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--surface);
          border-bottom: 1px solid var(--hairline);
          padding: 16px 16px 12px;
        }
        .feed__brand {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          color: var(--brand-crimson);
          margin-bottom: 2px;
        }
        .feed__tagline {
          font-size: 12px;
          color: var(--ink-2);
          margin-bottom: 12px;
        }
        .feed__search {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 42px;
          padding: 0 14px;
          margin-bottom: 12px;
          border: none;
          border-radius: 999px;
          background: var(--bg);
          color: var(--ink-2);
          font-size: 13px;
          font-family: var(--font-ui);
          text-align: left;
        }
        .feed__search svg {
          flex-shrink: 0;
          color: var(--ink-2);
        }
        .feed__tabs {
          display: flex;
          gap: 18px;
          overflow-x: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .feed__tabs::-webkit-scrollbar {
          display: none;
        }
        .feed__tab {
          flex-shrink: 0;
          border: none;
          background: none;
          padding: 0 0 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-2);
          white-space: nowrap;
          border-bottom: 2px solid transparent;
        }
        .feed__tab.is-active {
          color: var(--ink);
          font-weight: 700;
          border-bottom-color: var(--accent);
        }
      `}</style>

      <div className="feed__header">
        <div className="feed__brand">SPOTTED</div>
        <div className="feed__tagline">Pre-loved. Re-loved.</div>
        <button type="button" className="feed__search" onClick={() => navigate('/search')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search SPOTTED
        </button>
        <div className="feed__tabs">
          {CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`feed__tab${active === chip.key ? ' is-active' : ''}`}
              onClick={() => setActive(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <EmptyState emoji="🔍" title="Nothing here yet" subtitle="Try a different category." />
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
