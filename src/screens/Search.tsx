import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import { getFeed, searchListings, subscribe } from '../data/store';
import type { Category } from '../data/types';

const SHORTCUTS: { key: Category; label: string }[] = [
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'sneakers', label: 'Sneakers' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'home', label: 'Home' },
  { key: 'vintage', label: 'Vintage' },
];

export default function Search() {
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const results = useMemo(
    () => (query.trim() ? searchListings(query) : getFeed()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, tick]
  );

  return (
    <div className="search-screen">
      <style>{`
        .search-screen__header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface);
          border-bottom: 1px solid var(--hairline);
          padding: 16px;
        }
        .search-screen__back {
          border: none;
          background: none;
          color: var(--ink);
          font-size: 20px;
          line-height: 1;
          padding: 0;
        }
        .search-screen__input {
          flex: 1;
          height: 42px;
          padding: 0 14px;
          border: none;
          border-radius: 999px;
          background: var(--bg);
          color: var(--ink);
          font-size: 13px;
          font-family: var(--font-ui);
        }
        .search-screen__input:focus {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .search-screen__shortcuts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 16px;
        }
        .search-screen__shortcut {
          border: 1px solid var(--hairline);
          background: var(--surface);
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 999px;
        }
      `}</style>

      <div className="search-screen__header">
        <button type="button" className="search-screen__back" aria-label="Back" onClick={() => navigate(-1)}>
          ←
        </button>
        <input
          className="search-screen__input"
          type="text"
          autoFocus
          placeholder="Search title, category, brand, seller…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query.trim() && (
        <div className="search-screen__shortcuts">
          {SHORTCUTS.map((s) => (
            <button key={s.key} type="button" className="search-screen__shortcut" onClick={() => setQuery(s.label)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState emoji="🔍" title="No matches" subtitle="Try a different search." />
      ) : (
        <div className="listing-grid">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
