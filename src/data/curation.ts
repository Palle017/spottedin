// Rules-based personalized feed ranking. Deterministic, no RNG/network/LLM.
// All scoring logic is isolated here so a future model-backed ranker (same
// seam discipline as src/data/backend/) can replace the body without any
// call site changes.

import { getListing, getLikedIds, getOrders } from './store';
import type { Listing } from './types';

const LIKE_WEIGHT = 1;
const PURCHASE_WEIGHT = 3;
const BUBBLE_CAP_WINDOW = 10;
const BUBBLE_CAP_SHARE = 0.6;

type PriceBand = '<500' | '500-2000' | '2000-10000' | '10000+';

export interface TasteProfile {
  category: Record<string, number>;
  condition: Record<string, number>;
  priceBand: Record<string, number>;
}

function priceBand(priceINR: number): PriceBand {
  if (priceINR < 500) return '<500';
  if (priceINR < 2000) return '500-2000';
  if (priceINR < 10000) return '2000-10000';
  return '10000+';
}

function bump(bag: Record<string, number>, key: string, weight: number): void {
  bag[key] = (bag[key] ?? 0) + weight;
}

function absorb(profile: TasteProfile, listing: Listing, weight: number): void {
  bump(profile.category, listing.category, weight);
  bump(profile.condition, listing.condition, weight);
  bump(profile.priceBand, priceBand(listing.priceINR), weight);
}

/** Aggregates the current browser user's likes + purchases into taste weights. */
export function computeTasteProfile(): TasteProfile {
  const profile: TasteProfile = { category: {}, condition: {}, priceBand: {} };

  for (const id of getLikedIds()) {
    const listing = getListing(id);
    if (listing) absorb(profile, listing, LIKE_WEIGHT);
  }

  for (const order of getOrders()) {
    const listing = getListing(order.listingId);
    if (listing) absorb(profile, listing, PURCHASE_WEIGHT);
  }

  return profile;
}

function hasSignal(profile: TasteProfile): boolean {
  return (
    Object.keys(profile.category).length > 0 ||
    Object.keys(profile.condition).length > 0 ||
    Object.keys(profile.priceBand).length > 0
  );
}

function score(listing: Listing, profile: TasteProfile, recency: number): number {
  const categoryScore = profile.category[listing.category] ?? 0;
  const conditionScore = profile.condition[listing.condition] ?? 0;
  const priceScore = profile.priceBand[priceBand(listing.priceINR)] ?? 0;
  return categoryScore * 3 + conditionScore * 2 + priceScore + recency * 0.5;
}

// Keeps any single category under ~60% of the first 10 slots so one strong
// taste signal can't crowd the rest of the feed out; overflow is interleaved
// back in behind the capped window, preserving its relative order.
function capFilterBubble(ranked: Listing[]): Listing[] {
  const maxPerCategory = Math.ceil(BUBBLE_CAP_WINDOW * BUBBLE_CAP_SHARE);
  const head: Listing[] = [];
  const overflow: Listing[] = [];
  const counts: Record<string, number> = {};

  for (const listing of ranked) {
    const count = counts[listing.category] ?? 0;
    if (head.length < BUBBLE_CAP_WINDOW && count < maxPerCategory) {
      head.push(listing);
      counts[listing.category] = count + 1;
    } else {
      overflow.push(listing);
    }
  }

  return [...head, ...overflow];
}

/**
 * Ranks listings for a given user by taste-profile fit, with a recency term
 * (input order used as a proxy) and a filter-bubble cap on the top window.
 * Zero-signal users (no likes/orders) and logged-out (`userId === null`)
 * fall through unchanged.
 */
export function rankFeed(listings: Listing[], userId: string | null): Listing[] {
  if (!userId) return listings;

  const profile = computeTasteProfile();
  if (!hasSignal(profile)) return listings;

  const live = listings.filter((l) => l.status !== 'sold');
  const sold = listings.filter((l) => l.status === 'sold');

  const ranked = live
    .map((listing, index) => ({
      listing,
      s: score(listing, profile, live.length > 1 ? (live.length - index) / live.length : 0),
    }))
    .sort((a, b) => b.s - a.s)
    .map((entry) => entry.listing);

  return [...capFilterBubble(ranked), ...sold];
}
