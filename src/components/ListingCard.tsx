import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../data/types';
import { isLiked, toggleLike } from '../data/store';
import PriceTag from './PriceTag';

interface ListingCardProps {
  listing: Listing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const [liked, setLiked] = useState(() => isLiked(listing.id));

  function handleLike(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(listing.id);
    setLiked((prev) => !prev);
  }

  const sold = listing.status === 'sold';
  const meta = listing.size ? `${listing.size} · ${listing.condition}` : listing.condition;

  return (
    <Link to={`/listing/${listing.id}`} className="listing-card">
      <div className="listing-card__tile">
        <div
          className={`listing-card__media${sold ? ' listing-card__media--sold' : ''}`}
          style={
            listing.photoDataUrl || (listing.imageKind === 'photo' && listing.photo)
              ? undefined
              : { background: `linear-gradient(135deg, ${listing.gradient[0]}, ${listing.gradient[1]})` }
          }
        >
          {listing.photoDataUrl ? (
            <img src={listing.photoDataUrl} alt="" className="listing-card__img" loading="lazy" />
          ) : listing.imageKind === 'photo' && listing.photo ? (
            <img src={`${import.meta.env.BASE_URL}${listing.photo.replace(/^\//, '')}`} alt="" className="listing-card__img" loading="lazy" />
          ) : (
            <span aria-hidden="true">{listing.emoji}</span>
          )}
        </div>
        {sold && <span className="listing-card__sold">Sold</span>}
        <button
          type="button"
          className="listing-card__like"
          aria-label={liked ? 'Unlike' : 'Like'}
          onClick={handleLike}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 20.5s-7.6-4.6-10.1-8.8C.4 8.7.9 5 3.9 3.5c2.3-1.2 4.9-.5 6.4 1.5l1.7 2.2 1.7-2.2c1.5-2 4.1-2.7 6.4-1.5 3 1.5 3.5 5.2 1.8 8.2-2.5 4.2-10.1 8.8-10.1 8.8z"
              fill={liked ? 'var(--accent)' : 'none'}
              stroke={liked ? 'var(--accent)' : '#fff'}
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      <div className="listing-card__body">
        <PriceTag priceINR={listing.priceINR} />
        <span className="listing-card__meta">{meta}</span>
      </div>
    </Link>
  );
}
