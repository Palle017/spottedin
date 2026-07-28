// Supabase-backed implementation of src/data/store.ts's exported functions
// (except `subscribe`, which is a browser event bus, not a data operation).
// Parallel module: not wired into store.ts's call sites (see backend/README.md
// for why). Every function here is async because it talks to the network;
// callers activating this backend are expected to await accordingly.

import type {
  AuthUser,
  Category,
  CreateListingInput,
  Listing,
  Msg,
  Order,
  PayMethod,
  RegisterInput,
  Seller,
  Thread,
  UpdateProfileInput,
} from '../types';
import { getSupabase } from './supabaseClient';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_inr: number;
  category: Category;
  size: string | null;
  condition: Listing['condition'];
  gradient_from: string;
  gradient_to: string;
  emoji: string;
  photo_data_url: string | null;
  likes: number;
  status: Listing['status'];
  created_at: string;
}

interface SellerRow {
  id: string;
  handle: string;
  name: string;
  avatar_emoji: string;
  bio: string;
  city: string;
  rating: number;
  sales: number;
}

interface ThreadRow {
  id: string;
  listing_id: string;
  peer_id: string;
  messages: MessageRow[] | null;
}

interface MessageRow {
  sender_id: string | null;
  body: string;
  created_at: string;
}

interface OrderRow {
  id: string;
  listing_id: string;
  pay_method: PayMethod;
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    priceINR: row.price_inr,
    category: row.category,
    size: row.size ?? undefined,
    condition: row.condition,
    imageKind: 'gradient',
    gradient: [row.gradient_from, row.gradient_to],
    emoji: row.emoji,
    photoDataUrl: row.photo_data_url ?? undefined,
    likes: row.likes,
    status: row.status,
    createdAgo: timeAgo(row.created_at),
  };
}

function rowToSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    avatarEmoji: row.avatar_emoji,
    bio: row.bio,
    city: row.city,
    rating: row.rating,
    sales: row.sales,
  };
}

function rowToThread(row: ThreadRow, uid: string): Thread {
  const messages: Msg[] = [...(row.messages ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((m) => ({
      from: m.sender_id === uid ? 'me' : 'peer',
      text: m.body,
      timeAgo: timeAgo(m.created_at),
    }));
  return { id: row.id, listingId: row.listing_id, peerId: row.peer_id, messages };
}

function rowToOrder(row: OrderRow): Order {
  return { id: row.id, listingId: row.listing_id, status: 'placed', payMethod: row.pay_method };
}

async function requireUid(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not logged in');
  return data.user.id;
}

// ---- Feed / listings -------------------------------------------------

export async function getFeed(filter?: Category): Promise<Listing[]> {
  const sb = getSupabase();
  let query = sb.from('listings').select('*').order('created_at', { ascending: false });
  if (filter) query = query.eq('category', filter);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ListingRow[] ?? []).map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data as ListingRow) : undefined;
}

export async function isLiked(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id;
  if (!uid) return false;
  const { data, error } = await sb
    .from('likes')
    .select('listing_id')
    .eq('user_id', uid)
    .eq('listing_id', id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleLike(id: string): Promise<void> {
  const sb = getSupabase();
  const uid = await requireUid();

  const { data: existing, error: likeError } = await sb
    .from('likes')
    .select('listing_id')
    .eq('user_id', uid)
    .eq('listing_id', id)
    .maybeSingle();
  if (likeError) throw likeError;

  const { data: listingRow, error: listingError } = await sb
    .from('listings')
    .select('likes')
    .eq('id', id)
    .single();
  if (listingError) throw listingError;

  if (existing) {
    const { error } = await sb.from('likes').delete().eq('user_id', uid).eq('listing_id', id);
    if (error) throw error;
    const { error: updateError } = await sb
      .from('listings')
      .update({ likes: Math.max(0, listingRow.likes - 1) })
      .eq('id', id);
    if (updateError) throw updateError;
  } else {
    const { error } = await sb.from('likes').insert({ user_id: uid, listing_id: id });
    if (error) throw error;
    const { error: updateError } = await sb
      .from('listings')
      .update({ likes: listingRow.likes + 1 })
      .eq('id', id);
    if (updateError) throw updateError;
  }
}

export async function createListing(input: CreateListingInput): Promise<Listing> {
  const sb = getSupabase();
  const uid = await requireUid();

  const id = `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await sb
    .from('listings')
    .insert({
      id,
      seller_id: uid,
      title: input.title,
      description: input.description,
      price_inr: input.priceINR,
      category: input.category,
      size: input.size ?? null,
      condition: input.condition,
      gradient_from: input.gradient[0],
      gradient_to: input.gradient[1],
      emoji: input.emoji,
      photo_data_url: input.photoDataUrl ?? null,
      likes: 0,
      status: 'live',
    })
    .select()
    .single();
  if (error) throw error;
  return rowToListing(data as ListingRow);
}

// ---- Sellers -----------------------------------------------------------

export async function getSeller(id: string): Promise<Seller | undefined> {
  const sb = getSupabase();
  const { data: profile, error: profileError } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (profileError) throw profileError;
  if (profile) return rowToSeller(profile as SellerRow);

  const { data: seller, error: sellerError } = await sb.from('sellers').select('*').eq('id', id).maybeSingle();
  if (sellerError) throw sellerError;
  return seller ? rowToSeller(seller as SellerRow) : undefined;
}

export async function getSellerListings(id: string): Promise<Listing[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('listings')
    .select('*')
    .eq('seller_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ListingRow[] ?? []).map(rowToListing);
}

// ---- Threads / chat ------------------------------------------------------

export async function getThreads(): Promise<Thread[]> {
  const sb = getSupabase();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from('threads')
    .select('*, messages(*)')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ThreadRow[] ?? []).map((row) => rowToThread(row, uid));
}

export async function getThread(id: string): Promise<Thread | undefined> {
  const sb = getSupabase();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id ?? '';

  const { data, error } = await sb.from('threads').select('*, messages(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToThread(data as ThreadRow, uid) : undefined;
}

export async function getOrCreateThreadForListing(listingId: string): Promise<Thread> {
  const sb = getSupabase();
  const uid = await requireUid();

  const { data: existing, error: existingError } = await sb
    .from('threads')
    .select('*, messages(*)')
    .eq('listing_id', listingId)
    .eq('owner_id', uid)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return rowToThread(existing as ThreadRow, uid);

  const listing = await getListing(listingId);
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await sb
    .from('threads')
    .insert({ id, listing_id: listingId, peer_id: listing?.sellerId ?? '', owner_id: uid })
    .select('*, messages(*)')
    .single();
  if (error) throw error;
  return rowToThread(data as ThreadRow, uid);
}

export async function sendMessage(threadId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const sb = getSupabase();
  const uid = await requireUid();

  const { error } = await sb.from('messages').insert({ thread_id: threadId, sender_id: uid, body: text.trim() });
  if (error) throw error;
}

// ---- Checkout / orders ---------------------------------------------------

export async function placeOrder(listingId: string, payMethod: PayMethod): Promise<Order> {
  const sb = getSupabase();
  const uid = await requireUid();

  const { data: listingRow, error: listingError } = await sb
    .from('listings')
    .select('status')
    .eq('id', listingId)
    .single();
  if (listingError) throw listingError;
  if (listingRow.status === 'sold') throw new Error('This item has already been sold');

  const id = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await sb
    .from('orders')
    .insert({ id, listing_id: listingId, buyer_id: uid, pay_method: payMethod, status: 'placed' })
    .select()
    .single();
  if (error) throw error;

  const { error: updateError } = await sb.from('listings').update({ status: 'sold' }).eq('id', listingId);
  if (updateError) throw updateError;

  return rowToOrder(data as OrderRow);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data as OrderRow) : undefined;
}

// ---- Auth ------------------------------------------------------------

export async function getUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '', phone: data.user.phone ?? '', sellerId: data.user.id };
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({ email: input.email, password: input.password });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('Registration failed');

  const { error: profileError } = await sb.from('profiles').insert({
    id: user.id,
    handle: input.handle,
    name: input.name,
    avatar_emoji: input.avatarEmoji,
    bio: input.bio,
    city: input.city,
    phone: input.phone,
    rating: 0,
    sales: 0,
  });
  if (profileError) throw profileError;

  return { id: user.id, email: user.email ?? input.email, phone: input.phone, sellerId: user.id };
}

export async function loginWithPassword(identifier: string, password: string): Promise<AuthUser> {
  const sb = getSupabase();
  const value = identifier.trim();
  const isEmail = value.includes('@');

  const { data, error } = isEmail
    ? await sb.auth.signInWithPassword({ email: value, password })
    : await sb.auth.signInWithPassword({ phone: value, password });
  if (error || !data.user) throw new Error('Email/mobile number or password is incorrect');

  const { data: profile } = await sb.from('profiles').select('phone').eq('id', data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    phone: (profile?.phone as string | undefined) ?? data.user.phone ?? '',
    sellerId: data.user.id,
  };
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<Seller> {
  const sb = getSupabase();
  const uid = await requireUid();

  const { data, error } = await sb
    .from('profiles')
    .update({
      name: input.name,
      handle: input.handle,
      city: input.city,
      bio: input.bio,
      avatar_emoji: input.avatarEmoji,
    })
    .eq('id', uid)
    .select()
    .single();
  if (error) throw error;
  return rowToSeller(data as SellerRow);
}

export async function logout(): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}
