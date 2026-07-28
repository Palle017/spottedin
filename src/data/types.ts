// Core data model — shared by every screen/agent. Do not fork these shapes locally;
// import from here so the whole app stays on one source of truth.

export type Category = 'women' | 'men' | 'sneakers' | 'electronics' | 'home' | 'vintage';
export type Condition = 'new' | 'like-new' | 'good' | 'fair';
export type ListingStatus = 'live' | 'sold';
export type PayMethod = 'upi' | 'card' | 'cod';
export type MsgSender = 'me' | 'peer';

export interface Seller {
  id: string;
  handle: string;
  name: string;
  avatarEmoji: string;
  bio: string;
  city: string;
  rating: number; // 0–5
  sales: number;
  verified?: boolean;
  followers?: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  priceINR: number;
  category: Category;
  size?: string;
  condition: Condition;
  imageKind: 'gradient' | 'photo';
  gradient: [string, string];
  emoji: string;
  photo?: string;
  photoDataUrl?: string;
  likes: number;
  status: ListingStatus;
  createdAgo: string;
  brand?: string;
  hashtags?: string[];
  mrpINR?: number;
  boosted?: boolean;
}

export interface Msg {
  from: MsgSender;
  text: string;
  timeAgo: string;
  kind?: 'text' | 'offer';
  offerId?: string;
}

export interface Thread {
  id: string;
  listingId: string;
  peerId: string;
  messages: Msg[];
}

// Superset of the original single-value 'placed' status — existing Orders
// (and the old placeOrder()) remain valid values of this type.
export type OrderStatus =
  | 'placed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'return_requested'
  | 'refunded'
  | 'cancelled';

export interface TrackingEvent {
  status: OrderStatus;
  label: string;
  city?: string;
  at: number;
}

export interface Order {
  id: string;
  listingId: string;
  status: OrderStatus;
  payMethod: PayMethod;
  addressSnapshot?: Address;
  courierId?: string;
  courierName?: string;
  etaDays?: number;
  itemINR?: number;
  protectionFeeINR?: number;
  shippingFeeINR?: number;
  codFeeINR?: number;
  totalINR?: number;
  awb?: string;
  placedAt?: number;
  timeline?: TrackingEvent[];
  returnReason?: string;
}

export interface Review {
  id: string;
  sellerId: string;
  orderId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  reviewerName: string;
  timeAgo: string;
}

export interface Offer {
  id: string;
  listingId: string;
  threadId: string;
  amountINR: number;
  by: 'me' | 'peer';
  status: 'pending' | 'accepted' | 'declined' | 'countered';
  counterINR?: number;
  timeAgo: string;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  pincode: string;
  city: string;
  state: string;
  isDefault?: boolean;
}

export interface Notification {
  id: string;
  kind: 'like' | 'offer' | 'order' | 'message' | 'system';
  text: string;
  refPath: string;
  read: boolean;
  at: number;
}

export interface CourierQuote {
  id: string;
  name: string;
  etaDays: number;
  feeINR: number;
  codAvailable: boolean;
}

export interface Serviceability {
  serviceable: boolean;
  city?: string;
  state?: string;
  codAvailable?: boolean;
}

// Browser-local demo auth (email or mobile + password, PBKDF2-hashed in
// localStorage — NOT production security). `sellerId` points at the Seller
// profile created for this account (drives the Profile tab / SellerProfile).
export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  sellerId: string;
}

export interface RegisterInput {
  name: string;
  handle: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  bio: string;
  avatarEmoji: string;
}

export interface UpdateProfileInput {
  name: string;
  handle: string;
  city: string;
  bio: string;
  avatarEmoji: string;
}

// Input shape for creating a listing — everything the data layer fills in
// (id, sellerId, likes, status, createdAgo) is omitted here.
export interface CreateListingInput {
  title: string;
  description: string;
  priceINR: number;
  category: Category;
  size?: string;
  condition: Condition;
  gradient: [string, string];
  emoji: string;
  photoDataUrl?: string;
}
