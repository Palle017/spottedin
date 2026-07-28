import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import PriceTag from '../components/PriceTag';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../lib/format';
import {
  getListing,
  getSeller,
  isLiked,
  toggleLike,
  isFollowing,
  follow,
  unfollow,
  getSellerReviews,
  makeOffer,
  getOrCreateThreadForListing,
  subscribe,
} from '../data/store';

const CONDITION_LABEL: Record<string, string> = {
  new: 'New with tags',
  'like-new': 'Like new',
  good: 'Good',
  fair: 'Fair',
};

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const listing = id ? getListing(id) : undefined;
  const seller = listing ? getSeller(listing.sellerId) : undefined;

  if (!listing || !seller) {
    return (
      <>
        <TopBar title="Listing" />
        <EmptyState emoji="🕵️" title="Listing not found" subtitle="It may have been removed." />
      </>
    );
  }

  const liked = isLiked(listing.id);
  const following = isFollowing(seller.id);
  const sold = listing.status === 'sold';

  const hasDiscount = typeof listing.mrpINR === 'number' && listing.mrpINR > listing.priceINR;
  const discountPct = hasDiscount ? Math.round((1 - listing.priceINR / listing.mrpINR!) * 100) : 0;

  const metaParts = [listing.size, CONDITION_LABEL[listing.condition], listing.brand].filter(Boolean);

  const facts: { label: string; value: string }[] = [
    { label: 'Condition', value: CONDITION_LABEL[listing.condition] },
  ];
  if (listing.size) facts.push({ label: 'Size', value: listing.size });
  if (listing.brand) facts.push({ label: 'Brand', value: listing.brand });
  facts.push({ label: 'Category', value: listing.category.charAt(0).toUpperCase() + listing.category.slice(1) });

  const reviews = getSellerReviews(seller.id);
  const reviewCount = reviews.length > 0 ? reviews.length : seller.sales;
  const ratingGood = seller.rating >= 4;

  function handleLike() {
    toggleLike(listing!.id);
  }

  function handleFollow(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (following) unfollow(seller!.id);
    else follow(seller!.id);
  }

  function handleMessage() {
    const thread = getOrCreateThreadForListing(listing!.id);
    navigate(`/chat/${thread.id}`);
  }

  function handleBuy() {
    navigate(`/checkout/${listing!.id}`);
  }

  function openOffer() {
    setOfferAmount(String(Math.round(listing!.priceINR * 0.9)));
    setOfferOpen(true);
  }

  function submitOffer(e: FormEvent) {
    e.preventDefault();
    const amount = Number(offerAmount);
    if (!amount || amount <= 0) return;
    const thread = getOrCreateThreadForListing(listing!.id);
    makeOffer(listing!.id, thread.id, amount);
    setOfferOpen(false);
    navigate(`/chat/${thread.id}`);
  }

  const galleryStyle =
    !listing.photoDataUrl && !(listing.imageKind === 'photo' && listing.photo)
      ? { background: `linear-gradient(135deg, ${listing.gradient[0]}, ${listing.gradient[1]})` }
      : undefined;

  return (
    <div className="listing-detail">
      <style>{`
        .listing-detail__gallery {
          aspect-ratio: 4 / 5;
          position: relative;
          overflow: hidden;
          background: var(--bg);
        }
        .listing-detail__gallery-media {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 96px;
        }
        .listing-detail__gallery-media--sold {
          filter: grayscale(1);
        }
        .listing-detail__gallery-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .listing-detail__sold-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--ink);
          color: var(--surface);
          font-size: 13px;
          font-weight: 700;
          padding: 6px 16px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-radius: var(--radius-sm);
        }
        .listing-detail__back,
        .listing-detail__like {
          position: absolute;
          top: 14px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .listing-detail__back {
          left: 14px;
          font-size: 20px;
          color: var(--ink);
        }
        .listing-detail__like {
          right: 14px;
        }
        .listing-detail__body {
          padding: 16px;
          padding-bottom: 96px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .listing-detail__price-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .listing-detail__mrp {
          color: var(--ink-2);
          text-decoration: line-through;
          font-size: 14px;
        }
        .listing-detail__discount {
          color: var(--good);
          font-size: 13px;
          font-weight: 700;
        }
        .listing-detail__cod-pill {
          margin-left: auto;
          font-size: 11px;
          font-weight: 700;
          color: var(--good);
          border: 1px solid var(--good);
          padding: 4px 9px;
          border-radius: 999px;
        }
        .listing-detail__title {
          font-family: var(--font-ui);
          font-size: 19px;
          font-weight: 600;
        }
        .listing-detail__meta {
          font-size: 13px;
          color: var(--ink-2);
          margin-top: 2px;
        }
        .listing-detail__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .listing-detail__tag {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-2);
          background: var(--bg);
          border: 1px solid var(--hairline);
          padding: 5px 10px;
          border-radius: var(--radius-sm);
        }
        .listing-detail__facts {
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
          padding: 4px 14px;
        }
        .listing-detail__fact-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .listing-detail__fact-row:last-child {
          border-bottom: none;
        }
        .listing-detail__fact-value {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
        }
        .listing-detail__desc {
          font-size: 14px;
          line-height: 1.5;
          color: var(--ink);
        }
        .listing-detail__seller {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--hairline);
          border-radius: var(--radius);
        }
        .listing-detail__seller-info {
          flex: 1;
          min-width: 0;
        }
        .listing-detail__seller-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .listing-detail__seller-name {
          font-size: 14px;
          font-weight: 700;
        }
        .listing-detail__seller-verified {
          font-size: 11px;
          font-weight: 700;
          color: var(--good);
        }
        .listing-detail__seller-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 3px;
        }
        .listing-detail__seller-handle {
          font-size: 12px;
          color: var(--ink-2);
        }
        .listing-detail__rating-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .listing-detail__rating-pill--good {
          color: var(--good);
          background: rgba(10, 138, 74, 0.1);
        }
        .listing-detail__rating-pill--warn {
          color: var(--warn);
          background: rgba(198, 134, 43, 0.12);
        }
        .listing-detail__follow-btn {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1.5px solid var(--ink);
          background: var(--ink);
          color: var(--surface);
        }
        .listing-detail__follow-btn--following {
          background: transparent;
          color: var(--ink);
          border-color: var(--hairline);
        }
        .listing-detail__seller-chevron {
          color: var(--ink-2);
          font-size: 18px;
        }
        .listing-detail__trust {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: var(--ink-2);
        }
        .listing-detail__trust-line {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .listing-detail__buybar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 25;
          display: flex;
          align-items: stretch;
          gap: 8px;
          min-height: 56px;
          padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
          background: var(--surface);
          border-top: 1px solid var(--hairline);
        }
        .listing-detail__buybar-secondary {
          flex-shrink: 0;
          min-height: unset;
          padding: 8px 14px;
          font-size: 13px;
        }
        .listing-detail__buybar-buy {
          flex: 1;
          min-height: unset;
        }
        .listing-detail__offer-backdrop {
          position: absolute;
          inset: 0;
          z-index: 30;
          background: rgba(17, 17, 17, 0.35);
        }
        .listing-detail__offer-sheet {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 31;
          background: var(--surface);
          border-radius: 16px 16px 0 0;
          padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .listing-detail__offer-title {
          font-size: 15px;
          font-weight: 700;
        }
        .listing-detail__offer-actions {
          display: flex;
          gap: 10px;
        }
      `}</style>

      <div className="listing-detail__gallery">
        <div
          className={`listing-detail__gallery-media${sold ? ' listing-detail__gallery-media--sold' : ''}`}
          style={galleryStyle}
        >
          {listing.photoDataUrl ? (
            <img src={listing.photoDataUrl} alt="" className="listing-detail__gallery-img" />
          ) : listing.imageKind === 'photo' && listing.photo ? (
            <img
              src={`${import.meta.env.BASE_URL}${listing.photo.replace(/^\//, '')}`}
              alt=""
              className="listing-detail__gallery-img"
            />
          ) : (
            <span aria-hidden="true">{listing.emoji}</span>
          )}
        </div>

        {sold && <span className="listing-detail__sold-badge">Sold</span>}

        <button
          type="button"
          className="listing-detail__back"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          ‹
        </button>

        <button
          type="button"
          className="listing-detail__like"
          aria-label={liked ? 'Unlike' : 'Like'}
          onClick={handleLike}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 20.5s-7.6-4.6-10.1-8.8C.4 8.7.9 5 3.9 3.5c2.3-1.2 4.9-.5 6.4 1.5l1.7 2.2 1.7-2.2c1.5-2 4.1-2.7 6.4-1.5 3 1.5 3.5 5.2 1.8 8.2-2.5 4.2-10.1 8.8-10.1 8.8z"
              fill={liked ? 'var(--accent)' : 'none'}
              stroke={liked ? 'var(--accent)' : 'var(--ink)'}
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      <div className="listing-detail__body">
        <div className="listing-detail__price-row">
          <PriceTag priceINR={listing.priceINR} size="lg" />
          {hasDiscount && (
            <>
              <span className="listing-detail__mrp">{formatINR(listing.mrpINR!)}</span>
              <span className="listing-detail__discount">{discountPct}% OFF</span>
            </>
          )}
          <span className="listing-detail__cod-pill">COD available</span>
        </div>

        <div>
          <h2 className="listing-detail__title">{listing.title}</h2>
          <div className="listing-detail__meta">{metaParts.join(' · ')}</div>
        </div>

        {listing.hashtags && listing.hashtags.length > 0 && (
          <div className="listing-detail__tags">
            {listing.hashtags.map((tag) => (
              <Link key={tag} to={`/search?tag=${encodeURIComponent(tag)}`} className="listing-detail__tag">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="listing-detail__facts">
          {facts.map((fact) => (
            <div key={fact.label} className="listing-detail__fact-row">
              <span className="label-caps">{fact.label}</span>
              <span className="listing-detail__fact-value">{fact.value}</span>
            </div>
          ))}
        </div>

        <p className="listing-detail__desc">{listing.description}</p>

        <Link to={`/seller/${seller.id}`} className="listing-detail__seller">
          <Avatar emoji={seller.avatarEmoji} size={44} />
          <div className="listing-detail__seller-info">
            <div className="listing-detail__seller-name-row">
              <span className="listing-detail__seller-name">{seller.name}</span>
              {seller.verified && <span className="listing-detail__seller-verified">✓ ID Verified</span>}
            </div>
            <div className="listing-detail__seller-meta">
              <span className="listing-detail__seller-handle">{seller.handle}</span>
              <span
                className={`listing-detail__rating-pill ${ratingGood ? 'listing-detail__rating-pill--good' : 'listing-detail__rating-pill--warn'}`}
              >
                ⭐ {seller.rating.toFixed(1)} ({reviewCount})
              </span>
            </div>
          </div>
          <button
            type="button"
            className={`listing-detail__follow-btn${following ? ' listing-detail__follow-btn--following' : ''}`}
            onClick={handleFollow}
          >
            {following ? 'Following' : 'Follow'}
          </button>
          <span className="listing-detail__seller-chevron" aria-hidden="true">›</span>
        </Link>

        <div className="listing-detail__trust">
          <div className="listing-detail__trust-line">
            <span aria-hidden="true">↩️</span> 7-day returns
          </div>
          <div className="listing-detail__trust-line">
            <span aria-hidden="true">🛡️</span> SPOTTED Buyer Protection
          </div>
        </div>
      </div>

      <div className="listing-detail__buybar">
        <button
          type="button"
          className="btn btn-outline listing-detail__buybar-secondary"
          onClick={handleMessage}
        >
          💬 Message
        </button>
        <button
          type="button"
          className="btn btn-outline listing-detail__buybar-secondary"
          onClick={openOffer}
          disabled={sold}
        >
          Make offer
        </button>
        <button
          type="button"
          className="btn btn-primary listing-detail__buybar-buy"
          onClick={handleBuy}
          disabled={sold}
        >
          {sold ? 'Sold out' : 'Buy now'}
        </button>
      </div>

      {offerOpen && (
        <>
          <div className="listing-detail__offer-backdrop" onClick={() => setOfferOpen(false)} />
          <form className="listing-detail__offer-sheet" onSubmit={submitOffer}>
            <span className="listing-detail__offer-title">Make an offer</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              autoFocus
            />
            <div className="listing-detail__offer-actions">
              <button type="button" className="btn btn-outline btn-block" onClick={() => setOfferOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-block">
                Send offer
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
