import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import EmptyState from '../components/EmptyState';
import PriceTag from '../components/PriceTag';
import { getListing, getMyOrders, subscribe } from '../data/store';
import type { Order, OrderStatus } from '../data/types';
import './Orders.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  return_requested: 'Return requested',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

function pillClass(status: OrderStatus): string {
  if (status === 'delivered') return 'is-good';
  if (status === 'return_requested' || status === 'refunded') return 'is-warn';
  if (status === 'cancelled') return 'is-muted';
  return 'is-transit';
}

// Store only emits on mutations — a fresh order advances by elapsed time alone,
// so poll alongside subscribe() to reflect the demo timeline as it progresses.
const TICK_MS = 4000;

function useMyOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>(() => getMyOrders());

  useEffect(() => {
    const refresh = () => setOrders(getMyOrders());
    const unsub = subscribe(refresh);
    const interval = window.setInterval(refresh, TICK_MS);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  return orders;
}

export default function Orders() {
  const orders = useMyOrders();
  const sorted = [...orders].sort((a, b) => (b.placedAt ?? 0) - (a.placedAt ?? 0));

  return (
    <div>
      <TopBar title="My orders" />

      {sorted.length === 0 ? (
        <EmptyState emoji="📦" title="No orders yet" subtitle="When you buy something it'll show here." />
      ) : (
        <ul className="orders-list">
          {sorted.map((order) => {
            const listing = getListing(order.listingId);
            const hasPhoto = Boolean(listing?.photoDataUrl || (listing?.imageKind === 'photo' && listing.photo));

            return (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className="order-row">
                  <div
                    className="order-row__thumb"
                    style={
                      listing && !hasPhoto
                        ? { background: `linear-gradient(135deg, ${listing.gradient[0]}, ${listing.gradient[1]})` }
                        : undefined
                    }
                  >
                    {listing?.photoDataUrl ? (
                      <img src={listing.photoDataUrl} alt="" />
                    ) : listing?.imageKind === 'photo' && listing.photo ? (
                      <img src={`${import.meta.env.BASE_URL}${listing.photo.replace(/^\//, '')}`} alt="" />
                    ) : (
                      <span aria-hidden="true">{listing?.emoji ?? '🛍️'}</span>
                    )}
                  </div>
                  <div className="order-row__body">
                    <span className="order-row__title">{listing?.title ?? 'Item'}</span>
                    <span className="order-row__id">{order.id}</span>
                  </div>
                  <div className="order-row__meta">
                    <span className={`order-pill ${pillClass(order.status)}`}>{STATUS_LABEL[order.status]}</span>
                    <PriceTag priceINR={order.totalINR ?? listing?.priceINR ?? 0} size="sm" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
