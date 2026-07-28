import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import SkeletonGrid from '../components/Skeleton';
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

function HeroStamp() {
  return (
    <svg className="feed__stamp" width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="23.5" stroke="var(--brand-crimson)" strokeWidth="1.3" />
      <circle cx="26" cy="26" r="18" stroke="var(--brand-crimson)" strokeWidth="1" strokeDasharray="1.4 3.2" />
      <path
        d="M17.5 26.6l5.6 5.6 11.4-12.2"
        stroke="var(--brand-crimson)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Feed() {
  const [active, setActive] = useState<Category | 'all'>('all');
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const user = useMemo(() => getUser(), [tick]);

  const listings = useMemo(() => {
    const feed = getFeed(active === 'all' ? undefined : active);
    return user ? rankFeed(feed, user.sellerId) : feed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tick, user]);

  return (
    <div className="feed">
      <style>{`
        .feed__hero {
          background: var(--cream);
          padding: 22px 16px 16px;
        }
        .feed__hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .feed__wordmark {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 700;
          line-height: 0.9;
          letter-spacing: -0.01em;
          color: var(--brand-crimson);
        }
        .feed__stamp {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .feed__tagline {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 15px;
          color: var(--ink);
          margin-top: 8px;
        }
        .feed__value {
          font-size: 12.5px;
          line-height: 1.4;
          color: var(--ink-2);
          margin-top: 6px;
          max-width: 320px;
        }
        .feed__scallop {
          height: 10px;
          background-color: var(--cream);
          background-image: radial-gradient(circle at 6px 6px, var(--surface) 6px, transparent 6.5px);
          background-size: 12px 10px;
          background-repeat: repeat-x;
          background-position: bottom;
        }
        .feed__header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--surface);
          border-bottom: 1px solid var(--hairline);
          padding: 12px 16px;
        }
        .feed__search {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 46px;
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
          padding: 8px 0;
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

      <div className="feed__hero">
        <div className="feed__hero-top">
          <div className="feed__wordmark">SPOTTED</div>
          <HeroStamp />
        </div>
        <div className="feed__tagline">Spotted it first.</div>
        <p className="feed__value">Pre-loved fashion, sneakers &amp; finds — India&rsquo;s resale drop.</p>
      </div>
      <div className="feed__scallop" aria-hidden="true" />

      <div className="feed__header">
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

      {loading ? (
        <SkeletonGrid />
      ) : listings.length === 0 ? (
        <EmptyState title="Nothing here yet" subtitle="Try a different category." />
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
