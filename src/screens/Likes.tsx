import { useEffect, useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import EmptyState from '../components/EmptyState';
import ListingCard from '../components/ListingCard';
import { getLikedIds, getListing, subscribe } from '../data/store';
import type { Category, Listing } from '../data/types';

const CATEGORY_LABEL: Record<Category, string> = {
  women: 'Women',
  men: 'Men',
  sneakers: 'Sneakers',
  electronics: 'Electronics',
  home: 'Home',
  vintage: 'Vintage',
};

export default function Likes() {
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState<Category | 'all'>('all');

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const likedListings = useMemo(() => (
    getLikedIds()
      .map((id) => getListing(id))
      .filter((listing): listing is Listing => Boolean(listing))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [tick]);

  const categories = useMemo(
    () => Array.from(new Set(likedListings.map((l) => l.category))),
    [likedListings]
  );

  const visible = active === 'all' ? likedListings : likedListings.filter((l) => l.category === active);

  return (
    <div className="likes-screen">
      <style>{`
        .likes-screen__tabs {
          display: flex;
          gap: 18px;
          overflow-x: auto;
          padding: 12px 16px;
          border-bottom: 1px solid var(--hairline);
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .likes-screen__tabs::-webkit-scrollbar {
          display: none;
        }
        .likes-screen__tab {
          flex-shrink: 0;
          border: none;
          background: none;
          padding: 4px 0;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-2);
          white-space: nowrap;
          border-bottom: 2px solid transparent;
        }
        .likes-screen__tab.is-active {
          color: var(--ink);
          font-weight: 700;
          border-bottom-color: var(--accent);
        }
      `}</style>

      <TopBar title="Likes" />

      {likedListings.length === 0 ? (
        <EmptyState emoji="🤍" title="No saved items yet" subtitle="Tap the heart on anything to save it." />
      ) : (
        <>
          <div className="likes-screen__tabs">
            <button
              type="button"
              className={`likes-screen__tab${active === 'all' ? ' is-active' : ''}`}
              onClick={() => setActive('all')}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`likes-screen__tab${active === category ? ' is-active' : ''}`}
                onClick={() => setActive(category)}
              >
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState title="Nothing here" subtitle="Try a different category." />
          ) : (
            <div className="listing-grid">
              {visible.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
