import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import ListingCard from '../components/ListingCard';
import {
  follow,
  getOrCreateThreadForListing,
  getSeller,
  getSellerListings,
  getSellerReviews,
  getUser,
  isFollowing,
  logout,
  subscribe,
  unfollow,
  updateMyProfile,
} from '../data/store';
import type { Listing, Review, Seller } from '../data/types';
import './SellerProfile.css';

type Tab = 'listings' | 'reviews';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="review-card__stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? 'is-filled' : ''}>★</span>
      ))}
    </span>
  );
}

export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | undefined>(() => (id ? getSeller(id) : undefined));
  const [listings, setListings] = useState<Listing[]>(() => (id ? getSellerListings(id) : []));
  const [reviews, setReviews] = useState<Review[]>(() => (id ? getSellerReviews(id) : []));
  const [following, setFollowing] = useState(() => (id ? isFollowing(id) : false));
  const [tab, setTab] = useState<Tab>('listings');
  const [editing, setEditing] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!id) return;
    setSeller(getSeller(id));
    setListings(getSellerListings(id));
    setReviews(getSellerReviews(id));
    setFollowing(isFollowing(id));
    return subscribe(() => {
      setSeller(getSeller(id));
      setListings(getSellerListings(id));
      setReviews(getSellerReviews(id));
      setFollowing(isFollowing(id));
    });
  }, [id]);

  if (!seller) {
    return (
      <div>
        <TopBar title="Seller" />
        <EmptyState emoji="🧑" title="Seller not found" />
      </div>
    );
  }

  const isOwnProfile = getUser()?.sellerId === seller.id;
  const ratingTier = seller.rating >= 4 ? 'good' : seller.rating >= 3 ? 'warn' : 'neutral';

  function handleProfileSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      updateMyProfile({
        name: String(data.get('name') ?? ''),
        handle: String(data.get('handle') ?? ''),
        city: String(data.get('city') ?? ''),
        bio: String(data.get('bio') ?? ''),
        avatarEmoji: String(data.get('avatarEmoji') ?? ''),
      });
      setEditing(false);
      setProfileError('');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not update profile');
    }
  }

  function handleFollowToggle() {
    if (following) unfollow(seller!.id);
    else follow(seller!.id);
    setFollowing(!following);
  }

  function handleMessage() {
    if (listings.length === 0) return;
    const thread = getOrCreateThreadForListing(listings[0].id);
    navigate(`/chat/${thread.id}`);
  }

  return (
    <div className="seller-profile">
      <TopBar title={seller.handle} />

      <div className="seller-profile__header">
        <Avatar emoji={seller.avatarEmoji} size={72} verified={seller.verified} />
        <h2 className="seller-profile__name">{seller.name}</h2>
        <p className="seller-profile__handle">{seller.handle}</p>
        {seller.city && <p className="seller-profile__city">📍 {seller.city}</p>}
        {seller.bio && <p className="seller-profile__bio">{seller.bio}</p>}

        <div className="seller-profile__stats">
          <div className="seller-profile__stat">
            <span className="seller-profile__stat-value">{seller.followers ?? 0}</span>
            <span className="seller-profile__stat-label">Followers</span>
          </div>
          <div className="seller-profile__stat">
            <span className="seller-profile__stat-value">{seller.sales}</span>
            <span className="seller-profile__stat-label">Sales</span>
          </div>
          <div className="seller-profile__stat">
            <span className={`seller-profile__rating-pill seller-profile__rating-pill--${ratingTier}`}>
              ⭐ {seller.rating.toFixed(1)}
            </span>
            <span className="seller-profile__stat-label">{reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {isOwnProfile && !editing && (
          <div className="seller-profile__actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>
              Edit profile
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/orders')}>
              My orders
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/likes')}>
              Likes
            </button>
            <button
              type="button"
              className="seller-profile__logout"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Log out
            </button>
          </div>
        )}

        {!isOwnProfile && (
          <div className="seller-profile__actions">
            <button
              type="button"
              className={following ? 'btn btn-outline' : 'btn btn-primary'}
              onClick={handleFollowToggle}
            >
              {following ? 'Following' : 'Follow'}
            </button>
            {listings.length > 0 && (
              <button type="button" className="btn btn-outline" onClick={handleMessage}>
                Message
              </button>
            )}
          </div>
        )}
      </div>

      {isOwnProfile && editing && (
        <form className="seller-profile__edit" onSubmit={handleProfileSave}>
          <div className="seller-profile__edit-row">
            <div>
              <label className="field-label" htmlFor="profile-avatar">Avatar</label>
              <input
                id="profile-avatar"
                name="avatarEmoji"
                className="input seller-profile__avatar-input"
                defaultValue={seller.avatarEmoji}
                maxLength={4}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="profile-name">Full name</label>
              <input id="profile-name" name="name" className="input" defaultValue={seller.name} required />
            </div>
          </div>
          <label className="field-label" htmlFor="profile-handle">Handle</label>
          <input id="profile-handle" name="handle" className="input" defaultValue={seller.handle} required />
          <label className="field-label" htmlFor="profile-city">City</label>
          <input id="profile-city" name="city" className="input" defaultValue={seller.city} />
          <label className="field-label" htmlFor="profile-bio">Bio</label>
          <textarea id="profile-bio" name="bio" className="textarea" maxLength={160} defaultValue={seller.bio} />
          {profileError && <p className="seller-profile__error" role="alert">{profileError}</p>}
          <div className="seller-profile__edit-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save profile</button>
          </div>
        </form>
      )}

      <div className="seller-profile__tabs">
        <button
          type="button"
          className={`seller-profile__tab${tab === 'listings' ? ' is-active' : ''}`}
          onClick={() => setTab('listings')}
        >
          Listings
        </button>
        <button
          type="button"
          className={`seller-profile__tab${tab === 'reviews' ? ' is-active' : ''}`}
          onClick={() => setTab('reviews')}
        >
          Reviews · {reviews.length}
        </button>
      </div>

      {tab === 'listings' ? (
        listings.length === 0 ? (
          <EmptyState emoji="📦" title="Nothing listed yet" subtitle="Items this seller lists will show up here." />
        ) : (
          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )
      ) : reviews.length === 0 ? (
        <EmptyState emoji="⭐" title="No reviews yet" subtitle="Reviews from buyers will show up here." />
      ) : (
        <div className="seller-profile__reviews">
          {reviews.map((review) => (
            <div className="review-card" key={review.id}>
              <div className="review-card__head">
                <Stars rating={review.rating} />
                <span className="review-card__time">{review.timeAgo}</span>
              </div>
              <p className="review-card__text">{review.text}</p>
              <p className="review-card__name">{review.reviewerName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
