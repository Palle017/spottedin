import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import EmptyState from '../components/EmptyState';
import PriceTag from '../components/PriceTag';
import {
  getListing,
  getOrCreateThreadForListing,
  getOrder,
  requestReturn,
  resolveTimeline,
  subscribe,
} from '../data/store';
import type { Order, OrderStatus, TrackingEvent } from '../data/types';
import './OrderDetail.css';

const STEP_ORDER: OrderStatus[] = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

const STEP_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  packed: 'Packed at seller hub',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  return_requested: 'Return requested',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

const PAY_LABEL: Record<Order['payMethod'], string> = {
  upi: 'UPI',
  card: 'Credit / Debit card',
  cod: 'Cash on Delivery',
};

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// No persistent timer store-side — repoll on a short interval alongside
// subscribe() so a fresh order's timeline advances live without a leaked timer.
const TICK_MS = 3000;

interface Step {
  status: OrderStatus;
  label: string;
  city?: string;
  at?: number;
  reached: boolean;
}

function timeAgoLabel(at: number): string {
  const diffMs = Date.now() - at;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function buildSteps(order: Order, timeline: TrackingEvent[]): Step[] {
  const byStatus = new Map(timeline.map((e) => [e.status, e]));
  const effectiveStatus = timeline[timeline.length - 1]?.status ?? order.status;
  const effectiveIdx = STEP_ORDER.indexOf(effectiveStatus);

  const steps: Step[] = STEP_ORDER.map((status, i) => {
    const event = byStatus.get(status);
    return {
      status,
      label: event?.label ?? STEP_LABEL[status],
      city: event?.city,
      at: event?.at,
      reached: Boolean(event) || (effectiveIdx >= 0 && i <= effectiveIdx),
    };
  });

  if (effectiveStatus === 'return_requested' || effectiveStatus === 'refunded' || effectiveStatus === 'cancelled') {
    const event = byStatus.get(effectiveStatus);
    steps.push({
      status: effectiveStatus,
      label: event?.label ?? STEP_LABEL[effectiveStatus],
      city: event?.city,
      at: event?.at,
      reached: true,
    });
  }

  return steps;
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | undefined>(() => (id ? getOrder(id) : undefined));
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState('');

  useEffect(() => {
    if (!id) return;
    const refresh = () => setOrder(getOrder(id));
    refresh();
    const unsub = subscribe(refresh);
    const interval = window.setInterval(refresh, TICK_MS);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [id]);

  if (!order) {
    return (
      <>
        <TopBar title="Order" />
        <EmptyState emoji="🔍" title="Order not found" subtitle="This order doesn't exist or was removed." />
      </>
    );
  }

  const listing = getListing(order.listingId);
  const hasPhoto = Boolean(listing?.photoDataUrl || (listing?.imageKind === 'photo' && listing.photo));
  const timeline = resolveTimeline(order);
  const effectiveStatus = timeline[timeline.length - 1]?.status ?? order.status;
  const steps = buildSteps(order, timeline);
  const lastReachedIdx = steps.reduce((acc, step, i) => (step.reached ? i : acc), -1);

  const deliveredEvent = timeline.find((e) => e.status === 'delivered');
  const canReturn =
    effectiveStatus === 'delivered' && (!deliveredEvent || Date.now() - deliveredEvent.at <= RETURN_WINDOW_MS);

  function handleSubmitReturn(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setReturnError('');
    try {
      requestReturn(order.id, returnReason.trim() || 'No reason provided');
      setReturnOpen(false);
      setReturnReason('');
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Could not request return');
    }
  }

  function handleReportProblem() {
    if (!order) return;
    const thread = getOrCreateThreadForListing(order.listingId);
    navigate(`/chat/${thread.id}`);
  }

  return (
    <div className="order-detail">
      <TopBar title="Order details" />

      <div className="order-detail__header">
        <div
          className="order-detail__thumb"
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
        <div className="order-detail__header-body">
          <p className="order-detail__title">{listing?.title ?? 'Item'}</p>
          <p className="order-detail__meta">Order {order.id}</p>
          {order.awb && <p className="order-detail__meta">AWB {order.awb}</p>}
          {order.courierName && <p className="order-detail__meta">{order.courierName}</p>}
        </div>
      </div>

      <section className="order-detail__section">
        <h2 className="order-detail__heading">Tracking</h2>
        <ol className="order-timeline">
          {steps.map((step, i) => (
            <li
              key={step.status}
              className={`order-timeline__step${step.reached ? ' is-reached' : ''}${i === lastReachedIdx ? ' is-current' : ''}`}
            >
              <p className="order-timeline__label">{step.label}</p>
              {(step.city || step.at) && (
                <p className="order-timeline__meta">
                  {[step.city, step.at ? timeAgoLabel(step.at) : undefined].filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {order.addressSnapshot && (
        <section className="order-detail__section">
          <h2 className="order-detail__heading">Delivery address</h2>
          <div className="order-detail__card">
            <p className="order-detail__address-name">
              {order.addressSnapshot.fullName} · +91 {order.addressSnapshot.phone}
            </p>
            <p className="order-detail__address-lines">
              {order.addressSnapshot.line1}
              {order.addressSnapshot.line2 ? `, ${order.addressSnapshot.line2}` : ''}
              {order.addressSnapshot.landmark ? `, ${order.addressSnapshot.landmark}` : ''}
            </p>
            <p className="order-detail__address-lines">
              {order.addressSnapshot.city}, {order.addressSnapshot.state} – {order.addressSnapshot.pincode}
            </p>
          </div>
        </section>
      )}

      <section className="order-detail__section">
        <h2 className="order-detail__heading">Payment</h2>
        <div className="order-detail__card">
          <div className="order-detail__row">
            <span className="order-detail__row-label">Item price</span>
            <PriceTag priceINR={order.itemINR ?? listing?.priceINR ?? 0} size="sm" />
          </div>
          <div className="order-detail__row">
            <span className="order-detail__row-label">SPOTTED Buyer Protection</span>
            <PriceTag priceINR={order.protectionFeeINR ?? 0} size="sm" />
          </div>
          <div className="order-detail__row">
            <span className="order-detail__row-label">Shipping</span>
            <PriceTag priceINR={order.shippingFeeINR ?? 0} size="sm" />
          </div>
          {!!order.codFeeINR && (
            <div className="order-detail__row">
              <span className="order-detail__row-label">COD fee</span>
              <PriceTag priceINR={order.codFeeINR} size="sm" />
            </div>
          )}
          <div className="order-detail__row order-detail__row--total">
            <span className="order-detail__row-label">Total</span>
            <PriceTag priceINR={order.totalINR ?? 0} size="md" />
          </div>
          <div className="order-detail__row">
            <span className="order-detail__row-label">Payment method</span>
            <span className="order-detail__row-value">{PAY_LABEL[order.payMethod]}</span>
          </div>
        </div>
      </section>

      <section className="order-detail__section order-detail__actions">
        {effectiveStatus === 'return_requested' && (
          <p className="order-detail__note">
            Return requested{order.returnReason ? ` — ${order.returnReason}` : ''}. We'll update you here.
          </p>
        )}

        {canReturn && !returnOpen && (
          <button type="button" className="btn btn-outline btn-block" onClick={() => setReturnOpen(true)}>
            Request return
          </button>
        )}

        {returnOpen && (
          <form className="order-detail__return-form" onSubmit={handleSubmitReturn}>
            <label className="field-label" htmlFor="return-reason">Reason for return</label>
            <textarea
              id="return-reason"
              className="textarea"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Tell us what went wrong"
            />
            {returnError && <p className="order-detail__error">{returnError}</p>}
            <div className="order-detail__return-actions">
              <button type="button" className="btn btn-outline" onClick={() => setReturnOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Submit return</button>
            </div>
          </form>
        )}

        <button type="button" className="btn btn-outline btn-block" onClick={handleReportProblem}>
          Report a problem
        </button>
      </section>
    </div>
  );
}
