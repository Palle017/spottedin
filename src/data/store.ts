// Data layer — the ONLY module that touches localStorage. Screens/components
// must go through these functions, never read/write storage directly.

import type {
  Address,
  AuthUser,
  Category,
  CreateListingInput,
  Listing,
  Msg,
  MsgSender,
  Notification,
  Offer,
  Order,
  PayMethod,
  RegisterInput,
  Review,
  Seller,
  Thread,
  TrackingEvent,
  UpdateProfileInput,
} from './types';
import {
  listings as seedListings,
  notifications as seedNotifications,
  offers as seedOffers,
  orders as seedOrders,
  reviews as seedReviews,
  sellers,
  threads as seedThreads,
} from './seed';
import { payments } from '../services/payments';
import { protectionFeeINR as computeProtectionFeeINR } from '../services/checkoutMath';
import { shipping } from '../services/shipping';

const KEYS = {
  listings: 'spotted.listings',
  threads: 'spotted.threads',
  orders: 'spotted.orders',
  auth: 'spotted.auth',
  accounts: 'spotted.accounts',
  profiles: 'spotted.profiles',
  liked: 'spotted.likedIds',
  follows: 'spotted.follows',
  followerOverrides: 'spotted.followerOverrides',
  reviews: 'spotted.reviews',
  offers: 'spotted.offers',
  addresses: 'spotted.addresses',
  notifications: 'spotted.notifications',
} as const;

interface StoredAccount {
  user: AuthUser;
  passwordSalt: string;
  passwordHash: string;
}

const AUTO_REPLIES = [
  'Sounds good!',
  'Sure, that works for me.',
  'Let me check and get back to you.',
  'Yes, still available!',
  'Thanks for your interest 🙏',
  'Can do, deal!',
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`spotted: failed to persist "${key}"`, err);
  }
}

function emit(): void {
  window.dispatchEvent(new CustomEvent('spotted:update'));
}

/** Subscribe to any store mutation (listings, threads, orders, auth). Returns an unsubscribe fn. */
export function subscribe(cb: () => void): () => void {
  window.addEventListener('spotted:update', cb);
  return () => window.removeEventListener('spotted:update', cb);
}

function readListings(): Listing[] {
  return load<Listing[]>(KEYS.listings, seedListings);
}
function writeListings(list: Listing[]): void {
  save(KEYS.listings, list);
}

function readThreads(): Thread[] {
  return load<Thread[]>(KEYS.threads, seedThreads);
}
function writeThreads(list: Thread[]): void {
  save(KEYS.threads, list);
}

function readOrders(): Order[] {
  const stored = load<Order[]>(KEYS.orders, []);
  const ids = new Set(stored.map((o) => o.id));
  return [...stored, ...seedOrders.filter((o) => !ids.has(o.id))];
}
function writeOrders(list: Order[]): void {
  save(KEYS.orders, list);
}

function readLiked(): string[] {
  return load<string[]>(KEYS.liked, []);
}
function writeLiked(ids: string[]): void {
  save(KEYS.liked, ids);
}

function readFollows(): string[] {
  return load<string[]>(KEYS.follows, []);
}
function writeFollows(ids: string[]): void {
  save(KEYS.follows, ids);
}

function readFollowerOverrides(): Record<string, number> {
  return load<Record<string, number>>(KEYS.followerOverrides, {});
}
function writeFollowerOverrides(map: Record<string, number>): void {
  save(KEYS.followerOverrides, map);
}

function readReviews(): Review[] {
  return load<Review[]>(KEYS.reviews, []);
}
function writeReviews(list: Review[]): void {
  save(KEYS.reviews, list);
}

function readOffers(): Offer[] {
  return load<Offer[]>(KEYS.offers, []);
}
function writeOffers(list: Offer[]): void {
  save(KEYS.offers, list);
}
function allOffers(): Offer[] {
  const stored = readOffers();
  const ids = new Set(stored.map((o) => o.id));
  return [...stored, ...seedOffers.filter((o) => !ids.has(o.id))];
}

function readAddresses(): Address[] {
  return load<Address[]>(KEYS.addresses, []);
}
function writeAddresses(list: Address[]): void {
  save(KEYS.addresses, list);
}

function readNotifications(): Notification[] {
  return load<Notification[]>(KEYS.notifications, []);
}
function writeNotifications(list: Notification[]): void {
  save(KEYS.notifications, list);
}
function allNotifications(): Notification[] {
  const stored = readNotifications();
  const ids = new Set(stored.map((n) => n.id));
  return [...stored, ...seedNotifications.filter((n) => !ids.has(n.id))];
}

// ---- Feed / listings -------------------------------------------------

export function getFeed(filter?: Category): Listing[] {
  const all = readListings();
  return filter ? all.filter((l) => l.category === filter) : all;
}

export function getListing(id: string): Listing | undefined {
  return readListings().find((l) => l.id === id);
}

export function searchListings(q: string): Listing[] {
  const query = q.trim().toLowerCase();
  if (!query) return readListings();

  return readListings().filter((l) => {
    const seller = getSeller(l.sellerId);
    const haystack = [l.title, l.category, l.condition, l.brand ?? '', seller?.handle ?? '', ...(l.hashtags ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function isLiked(id: string): boolean {
  return readLiked().includes(id);
}

export function getLikedIds(): string[] {
  return readLiked();
}

export function toggleLike(id: string): void {
  const all = readListings();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return;

  const liked = readLiked();
  const likedIdx = liked.indexOf(id);
  const nowLiked = likedIdx === -1;

  all[idx] = { ...all[idx], likes: all[idx].likes + (nowLiked ? 1 : -1) };
  writeListings(all);

  if (nowLiked) writeLiked([...liked, id]);
  else writeLiked(liked.filter((likedId) => likedId !== id));

  if (nowLiked) {
    pushNotification({ kind: 'like', text: `You liked "${all[idx].title}"`, refPath: `/listing/${id}` });
  }

  emit();
}

export function createListing(input: CreateListingInput): Listing {
  const user = getUser();
  if (!user) throw new Error('Log in to create a listing');

  const listing: Listing = {
    id: `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    sellerId: user.sellerId,
    title: input.title,
    description: input.description,
    priceINR: input.priceINR,
    category: input.category,
    size: input.size,
    condition: input.condition,
    imageKind: 'gradient',
    gradient: input.gradient,
    emoji: input.emoji,
    photoDataUrl: input.photoDataUrl,
    likes: 0,
    status: 'live',
    createdAgo: 'just now',
  };

  writeListings([listing, ...readListings()]);
  emit();
  return listing;
}

// ---- Sellers -----------------------------------------------------------

export function getSeller(id: string): Seller | undefined {
  const base = load<Seller[]>(KEYS.profiles, []).find((s) => s.id === id)
    ?? sellers.find((s) => s.id === id);
  if (!base) return undefined;

  const override = readFollowerOverrides()[id];
  return override === undefined ? base : { ...base, followers: override };
}

export function getSellerListings(id: string): Listing[] {
  return readListings().filter((l) => l.sellerId === id);
}

// ---- Threads / chat ------------------------------------------------------

export function getThreads(): Thread[] {
  return readThreads();
}

export function getThread(id: string): Thread | undefined {
  return readThreads().find((t) => t.id === id);
}

export function getOrCreateThreadForListing(listingId: string): Thread {
  const existing = readThreads().find((t) => t.listingId === listingId);
  if (existing) return existing;

  const listing = getListing(listingId);
  const thread: Thread = {
    id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    listingId,
    peerId: listing?.sellerId ?? sellers[0].id,
    messages: [],
  };
  writeThreads([thread, ...readThreads()]);
  emit();
  return thread;
}

export function sendMessage(threadId: string, text: string): void {
  const all = readThreads();
  const idx = all.findIndex((t) => t.id === threadId);
  if (idx === -1 || !text.trim()) return;

  all[idx] = {
    ...all[idx],
    messages: [...all[idx].messages, { from: 'me', text: text.trim(), timeAgo: 'just now' }],
  };
  writeThreads(all);
  emit();

  window.setTimeout(() => {
    const latest = readThreads();
    const i = latest.findIndex((t) => t.id === threadId);
    if (i === -1) return;
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    latest[i] = {
      ...latest[i],
      messages: [...latest[i].messages, { from: 'peer', text: reply, timeAgo: 'just now' }],
    };
    writeThreads(latest);
    emit();
  }, 1200);
}

// ---- Checkout / orders ---------------------------------------------------

export function placeOrder(listingId: string, payMethod: PayMethod): Order {
  const all = readListings();
  const idx = all.findIndex((l) => l.id === listingId);
  if (idx === -1) throw new Error('Listing not found');
  if (all[idx].status === 'sold') throw new Error('This item has already been sold');

  const order: Order = {
    id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    listingId,
    status: 'placed',
    payMethod,
  };
  writeOrders([order, ...readOrders()]);

  const soldTitle = all[idx].title;
  all[idx] = { ...all[idx], status: 'sold' };
  writeListings(all);

  pushNotification({ kind: 'order', text: `Order placed for "${soldTitle}"`, refPath: `/orders/${order.id}` });
  emit();
  return order;
}

export function getOrder(id: string): Order | undefined {
  return readOrders().find((o) => o.id === id);
}

export function getOrders(): Order[] {
  return readOrders();
}

// ---- Auth (browser-local demo: PBKDF2-hashed passwords in localStorage) ----

export function getUser(): AuthUser | null {
  const user = load<AuthUser | null>(KEYS.auth, null);
  if (!user) return null;
  // Sessions from the old mocked-OTP build have no backing account/profile;
  // drop them so the app never shows an "own" profile it can't edit.
  if (!readAccounts().some((account) => account.user.id === user.id)) {
    localStorage.removeItem(KEYS.auth);
    return null;
  }
  return user;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeHandle(handle: string): string {
  const value = handle.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._]/g, '');
  return `@${value}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltParts = saltHex.match(/.{1,2}/g) ?? [];
  const salt = new Uint8Array(saltParts.map((part) => Number.parseInt(part, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120_000 },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function readAccounts(): StoredAccount[] {
  return load<StoredAccount[]>(KEYS.accounts, []);
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const handle = normalizeHandle(input.handle);
  const accounts = readAccounts();
  const profiles = load<Seller[]>(KEYS.profiles, []);

  if (!input.name.trim()) throw new Error('Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number');
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters');
  if (handle.length < 4) throw new Error('Handle must be at least 3 characters');
  if (accounts.some((account) => account.user.email === email)) throw new Error('That email is already registered');
  if (accounts.some((account) => account.user.phone === phone)) throw new Error('That mobile number is already registered');
  if ([...sellers, ...profiles].some((seller) => seller.handle.toLowerCase() === handle)) {
    throw new Error('That handle is already taken');
  }

  const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sellerId = `seller-${id}`;
  const user: AuthUser = { id, email, phone, sellerId };
  const profile: Seller = {
    id: sellerId,
    handle,
    name: input.name.trim(),
    avatarEmoji: input.avatarEmoji.trim().slice(0, 4) || '🙂',
    bio: input.bio.trim() || 'New to SPOTTED',
    city: input.city.trim() || 'India',
    rating: 0,
    sales: 0,
  };
  const passwordSalt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(input.password, passwordSalt);

  save(KEYS.accounts, [...accounts, { user, passwordSalt, passwordHash }]);
  save(KEYS.profiles, [...profiles, profile]);
  save(KEYS.auth, user);
  emit();
  return user;
}

export async function loginWithPassword(identifier: string, password: string): Promise<AuthUser> {
  const value = identifier.trim();
  const isEmail = value.includes('@');
  const normalized = isEmail ? normalizeEmail(value) : normalizePhone(value);
  const account = readAccounts().find((candidate) => (
    isEmail ? candidate.user.email === normalized : candidate.user.phone === normalized
  ));

  if (!account || await hashPassword(password, account.passwordSalt) !== account.passwordHash) {
    throw new Error('Email/mobile number or password is incorrect');
  }

  save(KEYS.auth, account.user);
  emit();
  return account.user;
}

export function updateMyProfile(input: UpdateProfileInput): Seller {
  const user = getUser();
  if (!user) throw new Error('Log in to update your profile');

  const profiles = load<Seller[]>(KEYS.profiles, []);
  const index = profiles.findIndex((profile) => profile.id === user.sellerId);
  if (index === -1) throw new Error('Profile not found');

  const handle = normalizeHandle(input.handle);
  if (!input.name.trim()) throw new Error('Enter your name');
  if (handle.length < 4) throw new Error('Handle must be at least 3 characters');
  if ([...sellers, ...profiles].some((profile) => (
    profile.id !== user.sellerId && profile.handle.toLowerCase() === handle
  ))) {
    throw new Error('That handle is already taken');
  }

  const profile: Seller = {
    ...profiles[index],
    name: input.name.trim(),
    handle,
    city: input.city.trim() || 'India',
    bio: input.bio.trim() || 'New to SPOTTED',
    avatarEmoji: input.avatarEmoji.trim().slice(0, 4) || '🙂',
  };
  profiles[index] = profile;
  save(KEYS.profiles, profiles);
  emit();
  return profile;
}

export function logout(): void {
  localStorage.removeItem(KEYS.auth);
  emit();
}

// ---- Follows ---------------------------------------------------------

function bumpSellerFollowers(sellerId: string, delta: number): void {
  const overrides = readFollowerOverrides();
  const base = getSeller(sellerId)?.followers ?? 0;
  const current = overrides[sellerId] ?? base;
  overrides[sellerId] = Math.max(0, current + delta);
  writeFollowerOverrides(overrides);
}

export function isFollowing(sellerId: string): boolean {
  return readFollows().includes(sellerId);
}

export function getFollowedSellerIds(): string[] {
  return readFollows();
}

export function follow(sellerId: string): void {
  const ids = readFollows();
  if (ids.includes(sellerId)) return;
  writeFollows([...ids, sellerId]);
  bumpSellerFollowers(sellerId, 1);
  emit();
}

export function unfollow(sellerId: string): void {
  const ids = readFollows();
  if (!ids.includes(sellerId)) return;
  writeFollows(ids.filter((followedId) => followedId !== sellerId));
  bumpSellerFollowers(sellerId, -1);
  emit();
}

// ---- Reviews -----------------------------------------------------------

export function getSellerReviews(sellerId: string): Review[] {
  const stored = readReviews().filter((r) => r.sellerId === sellerId);
  const seeded = seedReviews.filter((r) => r.sellerId === sellerId);
  return [...stored, ...seeded];
}

export function addReview(input: {
  sellerId: string;
  orderId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  reviewerName: string;
}): Review {
  const review: Review = {
    id: `rv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    sellerId: input.sellerId,
    orderId: input.orderId,
    rating: input.rating,
    text: input.text,
    reviewerName: input.reviewerName,
    timeAgo: 'just now',
  };
  writeReviews([review, ...readReviews()]);
  emit();
  return review;
}

// ---- Offers --------------------------------------------------------------

function appendOfferMessage(threadId: string, offerId: string, from: MsgSender, text: string): void {
  const all = readThreads();
  const idx = all.findIndex((t) => t.id === threadId);
  if (idx === -1) return;

  const msg: Msg = { from, text, timeAgo: 'just now', kind: 'offer', offerId };
  all[idx] = { ...all[idx], messages: [...all[idx].messages, msg] };
  writeThreads(all);
  emit();
}

function updateOffer(id: string, patch: Partial<Offer>): Offer {
  const merged = allOffers().map((o) => (o.id === id ? { ...o, ...patch } : o));
  writeOffers(merged);
  emit();
  const updated = merged.find((o) => o.id === id);
  if (!updated) throw new Error('Offer not found');
  return updated;
}

function peerRespondToOffer(offerId: string): void {
  const offer = allOffers().find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pending') return;
  const listing = getListing(offer.listingId);
  if (!listing) return;

  const ratio = offer.amountINR / listing.priceINR;
  if (ratio >= 0.9) {
    const updated = updateOffer(offerId, { status: 'accepted' });
    appendOfferMessage(updated.threadId, updated.id, 'peer', `Accepted your offer of ₹${updated.amountINR}`);
    pushNotification({ kind: 'offer', text: `Your offer of ₹${updated.amountINR} was accepted`, refPath: `/chat/${updated.threadId}` });
  } else if (ratio >= 0.75) {
    const counterINR = Math.round(listing.priceINR * 0.95);
    const updated = updateOffer(offerId, { status: 'countered', counterINR });
    appendOfferMessage(updated.threadId, updated.id, 'peer', `How about ₹${counterINR}?`);
    pushNotification({ kind: 'offer', text: `Seller countered at ₹${counterINR}`, refPath: `/chat/${updated.threadId}` });
  } else {
    const updated = updateOffer(offerId, { status: 'declined' });
    appendOfferMessage(updated.threadId, updated.id, 'peer', `Sorry, can't accept ₹${updated.amountINR}`);
    pushNotification({ kind: 'offer', text: 'Your offer was declined', refPath: `/chat/${updated.threadId}` });
  }
}

export function makeOffer(listingId: string, threadId: string, amountINR: number): Offer {
  const offer: Offer = {
    id: `of-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    listingId,
    threadId,
    amountINR,
    by: 'me',
    status: 'pending',
    timeAgo: 'just now',
  };
  writeOffers([offer, ...allOffers()]);
  appendOfferMessage(threadId, offer.id, 'me', `Offered ₹${amountINR}`);
  pushNotification({ kind: 'offer', text: `You offered ₹${amountINR}`, refPath: `/chat/${threadId}` });
  emit();

  window.setTimeout(() => peerRespondToOffer(offer.id), 1500);
  return offer;
}

export function counterOffer(offerId: string, amountINR: number): Offer {
  const offer = updateOffer(offerId, { status: 'countered', counterINR: amountINR });
  appendOfferMessage(offer.threadId, offer.id, 'me', `Countered at ₹${amountINR}`);
  pushNotification({ kind: 'offer', text: `You countered at ₹${amountINR}`, refPath: `/chat/${offer.threadId}` });
  return offer;
}

export function acceptOffer(offerId: string): Offer {
  const offer = updateOffer(offerId, { status: 'accepted' });
  appendOfferMessage(offer.threadId, offer.id, 'me', `Accepted offer of ₹${offer.counterINR ?? offer.amountINR}`);
  pushNotification({ kind: 'offer', text: 'Offer accepted', refPath: `/chat/${offer.threadId}` });
  return offer;
}

export function declineOffer(offerId: string): Offer {
  const offer = updateOffer(offerId, { status: 'declined' });
  appendOfferMessage(offer.threadId, offer.id, 'me', 'Declined offer');
  pushNotification({ kind: 'offer', text: 'Offer declined', refPath: `/chat/${offer.threadId}` });
  return offer;
}

export function getOffer(offerId: string): Offer | undefined {
  return allOffers().find((o) => o.id === offerId);
}

export function getOffersForListing(listingId: string): Offer[] {
  return allOffers().filter((o) => o.listingId === listingId);
}

// ---- Addresses -------------------------------------------------------

export function getAddresses(): Address[] {
  return readAddresses();
}

export function saveAddress(input: Omit<Address, 'id'>): Address {
  const existing = readAddresses();
  const address: Address = {
    id: `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2,
    landmark: input.landmark,
    pincode: input.pincode,
    city: input.city,
    state: input.state,
    isDefault: existing.length === 0 ? true : Boolean(input.isDefault),
  };

  const next = address.isDefault
    ? [...existing.map((a) => ({ ...a, isDefault: false })), address]
    : [...existing, address];
  writeAddresses(next);
  emit();
  return address;
}

export function deleteAddress(id: string): void {
  const remaining = readAddresses().filter((a) => a.id !== id);
  if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
    remaining[0] = { ...remaining[0], isDefault: true };
  }
  writeAddresses(remaining);
  emit();
}

export function getDefaultAddress(): Address | undefined {
  const all = readAddresses();
  return all.find((a) => a.isDefault) ?? all[0];
}

// ---- Orders v2 (address + courier + fees, mock payment/shipping seams) ----

const TIMELINE_STAGES: { status: Order['status']; label: string; afterMs: number }[] = [
  { status: 'placed', label: 'Order placed', afterMs: 0 },
  { status: 'packed', label: 'Packed at seller hub', afterMs: 30_000 },
  { status: 'shipped', label: 'Shipped', afterMs: 2 * 60_000 },
  { status: 'out_for_delivery', label: 'Out for delivery', afterMs: 5 * 60_000 },
  { status: 'delivered', label: 'Delivered', afterMs: 8 * 60_000 },
];

const MANUAL_ORDER_STATUSES: Order['status'][] = ['return_requested', 'refunded', 'cancelled'];

/** Recomputes an order's tracking timeline from elapsed time since placedAt — no persistent timers needed for the demo. */
export function resolveTimeline(order: Order): TrackingEvent[] {
  if (!order.placedAt || MANUAL_ORDER_STATUSES.includes(order.status)) return order.timeline ?? [];

  const elapsed = Date.now() - order.placedAt;
  return TIMELINE_STAGES
    .filter((stage) => elapsed >= stage.afterMs)
    .map((stage) => ({
      status: stage.status,
      label: stage.label,
      city: order.addressSnapshot?.city,
      at: order.placedAt! + stage.afterMs,
    }));
}

export async function placeOrderFull(input: {
  listingId: string;
  addressId: string;
  payMethod: PayMethod;
  courierId: string;
  itemINR?: number;
}): Promise<Order> {
  const listings = readListings();
  const listingIdx = listings.findIndex((l) => l.id === input.listingId);
  if (listingIdx === -1) throw new Error('Listing not found');
  if (listings[listingIdx].status === 'sold') throw new Error('This item has already been sold');
  const listing = listings[listingIdx];

  const address = readAddresses().find((a) => a.id === input.addressId);
  if (!address) throw new Error('Address not found');

  const couriers = await shipping.getCouriers(address.pincode);
  const courier = couriers.find((c) => c.id === input.courierId);
  if (!courier) throw new Error('Selected courier is not available for this address');

  const itemINR = input.itemINR && input.itemINR > 0 ? Math.round(input.itemINR) : listing.priceINR;
  const protectionFeeINR = computeProtectionFeeINR(itemINR);
  const shippingFeeINR = courier.feeINR;
  const codFeeINR = input.payMethod === 'cod' ? 40 : 0;
  const totalINR = itemINR + protectionFeeINR + shippingFeeINR + codFeeINR;

  const payment = await payments.createPayment({
    amountINR: totalINR,
    method: input.payMethod,
    checkout: { listingId: input.listingId, courierId: courier.id, address },
  });
  if (!payment.ok) throw new Error(payment.error);

  const placedAt = Date.now();
  let order: Order = {
    id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    listingId: input.listingId,
    status: 'placed',
    payMethod: input.payMethod,
    addressSnapshot: address,
    courierId: courier.id,
    courierName: courier.name,
    etaDays: courier.etaDays,
    itemINR,
    protectionFeeINR,
    shippingFeeINR,
    codFeeINR,
    totalINR,
    placedAt,
    timeline: [{ status: 'placed', label: 'Order placed', at: placedAt }],
  };

  writeOrders([order, ...readOrders()]);
  listings[listingIdx] = { ...listing, status: 'sold' };
  writeListings(listings);
  emit();

  const shipment = await shipping.createShipment(order.id);
  order = { ...order, awb: shipment.awb, courierName: shipment.courierName };
  writeOrders(readOrders().map((o) => (o.id === order.id ? order : o)));

  pushNotification({ kind: 'order', text: `Order placed for "${listing.title}"`, refPath: `/orders/${order.id}` });
  emit();
  return order;
}

export function getMyOrders(): Order[] {
  return readOrders().map((order) => {
    if (!order.placedAt || MANUAL_ORDER_STATUSES.includes(order.status)) return order;
    const timeline = resolveTimeline(order);
    const latest = timeline[timeline.length - 1];
    return latest ? { ...order, status: latest.status, timeline } : order;
  });
}

export function requestReturn(orderId: string, reason: string): Order {
  const all = readOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const updated: Order = { ...all[idx], status: 'return_requested', returnReason: reason };
  all[idx] = updated;
  writeOrders(all);
  pushNotification({ kind: 'order', text: `Return requested for order ${orderId}`, refPath: `/orders/${orderId}` });
  emit();
  return updated;
}

// ---- Notifications ---------------------------------------------------

export function getNotifications(): Notification[] {
  return allNotifications().sort((a, b) => b.at - a.at);
}

export function markNotificationsRead(): void {
  const merged = allNotifications().map((n) => ({ ...n, read: true }));
  writeNotifications(merged);
  emit();
}

export function pushNotification(input: { kind: Notification['kind']; text: string; refPath: string }): Notification {
  const notification: Notification = {
    id: `nf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    text: input.text,
    refPath: input.refPath,
    read: false,
    at: Date.now(),
  };
  writeNotifications([notification, ...allNotifications()]);
  emit();
  return notification;
}

export function getUnreadCount(): number {
  return allNotifications().filter((n) => !n.read).length;
}

// ---- Boost -------------------------------------------------------------

export function boostListing(id: string): void {
  const all = readListings();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return;

  all[idx] = { ...all[idx], boosted: true };
  writeListings(all);
  emit();
}
