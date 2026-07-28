import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import PriceTag from '../components/PriceTag';
import EmptyState from '../components/EmptyState';
import { getAddresses, getDefaultAddress, getListing, placeOrderFull, saveAddress } from '../data/store';
import { shipping } from '../services/shipping';
import type { Address, CourierQuote, Order, PayMethod } from '../data/types';
import { formatINR } from '../lib/format';

type Step = 'address' | 'delivery' | 'payment' | 'success';

const STEPS: Step[] = ['address', 'delivery', 'payment'];
const STEP_LABEL: Record<Step, string> = {
  address: 'Address',
  delivery: 'Delivery',
  payment: 'Payment',
  success: 'Done',
};

const UPI_APPS: { id: string; label: string; emoji: string }[] = [
  { id: 'gpay', label: 'GPay', emoji: '🟢' },
  { id: 'phonepe', label: 'PhonePe', emoji: '🟣' },
  { id: 'paytm', label: 'Paytm', emoji: '🔵' },
  { id: 'bhim', label: 'BHIM', emoji: '🇮🇳' },
];

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;

function protectionFeeINR(itemINR: number): number {
  return Math.max(15, Math.round(itemINR * 0.02));
}

function formatEtaDate(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface AddressForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
}

const EMPTY_FORM: AddressForm = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
};

export default function Checkout() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listing = id ? getListing(id) : undefined;

  const offerParam = searchParams.get('offer') ?? searchParams.get('price');
  const itemINR = useMemo(() => {
    const parsed = offerParam ? Number(offerParam) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    return listing?.priceINR ?? 0;
  }, [offerParam, listing]);

  const [step, setStep] = useState<Step>('address');

  const [addresses, setAddresses] = useState<Address[]>(() => getAddresses());
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(() => getDefaultAddress()?.id);
  const [showForm, setShowForm] = useState(() => getAddresses().length === 0);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [pinStatus, setPinStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [pinError, setPinError] = useState('');
  const [formError, setFormError] = useState('');

  const [couriers, setCouriers] = useState<CourierQuote[]>([]);
  const [courierLoading, setCourierLoading] = useState(false);
  const [courierError, setCourierError] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState<string | undefined>();

  const [payMethod, setPayMethod] = useState<PayMethod>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState(UPI_APPS[0].id);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const selectedCourier = couriers.find((c) => c.id === selectedCourierId);

  useEffect(() => {
    if (step !== 'delivery' || !selectedAddress) return;
    let cancelled = false;
    setCourierLoading(true);
    setCourierError('');
    shipping
      .getCouriers(selectedAddress.pincode)
      .then((list) => {
        if (cancelled) return;
        setCouriers(list);
        setSelectedCourierId((prev) => (prev && list.some((c) => c.id === prev) ? prev : undefined));
      })
      .catch(() => {
        if (!cancelled) setCourierError('Could not load delivery options. Try again.');
      })
      .finally(() => {
        if (!cancelled) setCourierLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedAddress]);

  useEffect(() => {
    if (selectedCourier && !selectedCourier.codAvailable && payMethod === 'cod') setPayMethod('upi');
  }, [selectedCourier, payMethod]);

  if (!listing) {
    return (
      <>
        <TopBar title="Checkout" />
        <EmptyState emoji="🔍" title="Listing not found" subtitle="This item may have been removed." />
      </>
    );
  }

  if (listing.status === 'sold' && !order) {
    return (
      <>
        <TopBar title="Checkout" />
        <EmptyState emoji="✅" title="Already sold" subtitle="This item has already been bought by someone else." />
      </>
    );
  }

  const listingId = listing.id;

  function handleBack() {
    if (step === 'address') {
      navigate(-1);
    } else if (step === 'delivery') {
      setStep('address');
    } else if (step === 'payment') {
      setStep('delivery');
    }
  }

  async function checkPin(pin: string) {
    setPinStatus('checking');
    setPinError('');
    try {
      const result = await shipping.checkPincode(pin);
      if (result.serviceable) {
        setForm((f) => ({ ...f, city: result.city ?? f.city, state: result.state ?? f.state }));
        setPinStatus('ok');
      } else {
        setPinStatus('error');
        setPinError(`Not serviceable at ${pin}`);
      }
    } catch {
      setPinStatus('error');
      setPinError('Could not verify pincode. Try again.');
    }
  }

  function handlePincodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setForm((f) => ({ ...f, pincode: digits, city: '', state: '' }));
    if (digits.length === 6) {
      void checkPin(digits);
    } else {
      setPinStatus('idle');
      setPinError('');
    }
  }

  function handlePincodeBlur() {
    if (form.pincode.length === 6 && pinStatus === 'idle') void checkPin(form.pincode);
  }

  function handleSaveAddress(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.fullName.trim()) return setFormError('Enter your full name');
    if (!PHONE_RE.test(form.phone)) return setFormError('Enter a valid 10-digit mobile number');
    if (!form.line1.trim()) return setFormError('Enter address line 1');
    if (!PIN_RE.test(form.pincode)) return setFormError('Enter a valid 6-digit pincode');
    if (pinStatus !== 'ok') return setFormError(pinError || 'Check pincode serviceability first');

    const saved = saveAddress({
      fullName: form.fullName.trim(),
      phone: form.phone,
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      landmark: form.landmark.trim() || undefined,
      pincode: form.pincode,
      city: form.city,
      state: form.state,
    });
    setAddresses(getAddresses());
    setSelectedAddressId(saved.id);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setPinStatus('idle');
    setStep('delivery');
  }

  async function handlePlaceOrder() {
    if (!selectedAddressId || !selectedCourierId || placing) return;
    setPlacing(true);
    setPlaceError('');
    try {
      const placed = await placeOrderFull({
        listingId,
        addressId: selectedAddressId,
        payMethod,
        courierId: selectedCourierId,
        itemINR,
      });
      setOrder(placed);
      setStep('success');
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  }

  const protectionFee = protectionFeeINR(itemINR);
  const shippingFee = selectedCourier?.feeINR ?? 0;
  const codFee = payMethod === 'cod' ? 40 : 0;
  const total = itemINR + protectionFee + shippingFee + codFee;

  if (step === 'success' && order) {
    const etaLabel =
      order.etaDays != null ? formatEtaDate(order.etaDays, order.placedAt ? new Date(order.placedAt) : undefined) : undefined;

    return (
      <div className="checkout-page">
        <TopBar title="Order placed" onBack={() => navigate('/')} />
        <div className="checkout-success">
          <div className="checkout-success__badge" aria-hidden="true">✅</div>
          <h2 className="checkout-success__title">Order confirmed!</h2>
          <p className="checkout-success__sub">
            Your order for <strong>{listing.title}</strong> has been placed.
          </p>

          <div className="checkout-card checkout-success__card">
            <div className="checkout-row">
              <span className="checkout-row__label">Order ID</span>
              <span className="checkout-row__value checkout-row__value--mono">{order.id}</span>
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">AWB</span>
              <span className="checkout-row__value checkout-row__value--mono">{order.awb ?? '—'}</span>
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">Courier</span>
              <span className="checkout-row__value">{order.courierName ?? '—'}</span>
            </div>
            {etaLabel && (
              <div className="checkout-row">
                <span className="checkout-row__label">Arriving</span>
                <span className="checkout-row__value">{etaLabel}</span>
              </div>
            )}
            <div className="checkout-row">
              <span className="checkout-row__label">Item price</span>
              <PriceTag priceINR={order.itemINR ?? 0} size="sm" />
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">SPOTTED Buyer Protection</span>
              <PriceTag priceINR={order.protectionFeeINR ?? 0} size="sm" />
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">Shipping</span>
              <PriceTag priceINR={order.shippingFeeINR ?? 0} size="sm" />
            </div>
            {!!order.codFeeINR && (
              <div className="checkout-row">
                <span className="checkout-row__label">COD fee</span>
                <PriceTag priceINR={order.codFeeINR} size="sm" />
              </div>
            )}
            <div className="checkout-row checkout-row--total">
              <span className="checkout-row__label">Total</span>
              <PriceTag priceINR={order.totalINR ?? 0} size="md" />
            </div>
          </div>

          <p className="checkout-returns-note">📦 7-day returns on this item</p>
          <p className="checkout-razorpay-note">Payments by Razorpay — sandbox</p>

          <div className="checkout-success__actions">
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(`/orders/${order.id}`)}>
              Track order
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('/')}>
              Continue shopping
            </button>
          </div>
        </div>
        <CheckoutStyles />
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="checkout-page">
      <TopBar title={`Checkout · ${STEP_LABEL[step]}`} onBack={handleBack} />

      <div className="checkout-stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`checkout-stepper__item is-${i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming'}`}>
            <span className="checkout-stepper__dot">{i < stepIndex ? '✓' : i + 1}</span>
            <span className="checkout-stepper__label">{STEP_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="checkout-summary">
        <div
          className="checkout-summary__tile"
          style={{
            background: listing.photoDataUrl ? undefined : `linear-gradient(135deg, ${listing.gradient[0]}, ${listing.gradient[1]})`,
          }}
        >
          {listing.photoDataUrl ? (
            <img src={listing.photoDataUrl} alt="" className="checkout-summary__img" />
          ) : (
            <span aria-hidden="true">{listing.emoji}</span>
          )}
        </div>
        <div className="checkout-summary__info">
          <p className="checkout-summary__title">{listing.title}</p>
          {listing.size ? <p className="checkout-summary__meta">Size {listing.size}</p> : null}
          <PriceTag priceINR={itemINR} size="lg" />
        </div>
      </div>

      {step === 'address' && (
        <div className="checkout-step">
          <p className="checkout-step__heading">Deliver to</p>

          {addresses.length > 0 && !showForm && (
            <div className="checkout-address-list">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`checkout-address-card${selectedAddressId === a.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedAddressId(a.id)}
                >
                  <span className={`checkout-address-card__radio${selectedAddressId === a.id ? ' is-checked' : ''}`} aria-hidden="true" />
                  <span className="checkout-address-card__body">
                    <span className="checkout-address-card__name">{a.fullName} · +91 {a.phone}</span>
                    <span className="checkout-address-card__lines">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}
                      {a.landmark ? `, ${a.landmark}` : ''}
                    </span>
                    <span className="checkout-address-card__lines">{a.city}, {a.state} – {a.pincode}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!showForm && (
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowForm(true)}>
              + Add new address
            </button>
          )}

          {showForm && (
            <form className="checkout-address-form" onSubmit={handleSaveAddress}>
              <input
                className="input"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <div className="checkout-phone-field">
                <span className="checkout-phone-prefix">+91</span>
                <input
                  className="input"
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                />
              </div>
              <input
                className="input"
                placeholder="Address line 1"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Address line 2 (optional)"
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Landmark (optional)"
                value={form.landmark}
                onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
              />
              <input
                className="input"
                placeholder="6-digit pincode"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                onBlur={handlePincodeBlur}
              />
              {pinStatus === 'checking' && <p className="checkout-pin-note">Checking pincode…</p>}
              {pinStatus === 'ok' && (
                <p className="checkout-pin-note checkout-pin-note--ok">Delivers to {form.city}, {form.state}</p>
              )}
              {pinStatus === 'error' && <p className="checkout-pin-note checkout-pin-note--error">{pinError}</p>}
              <div className="checkout-form-row">
                <input className="input" placeholder="City" value={form.city} readOnly disabled />
                <input className="input" placeholder="State" value={form.state} readOnly disabled />
              </div>
              {formError && <p className="checkout-form-error">{formError}</p>}
              <div className="checkout-form-actions">
                {addresses.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-block"
                    onClick={() => {
                      setShowForm(false);
                      setFormError('');
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-block" disabled={pinStatus !== 'ok'}>
                  Save &amp; continue
                </button>
              </div>
            </form>
          )}

          {!showForm && addresses.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-block checkout-step__cta"
              disabled={!selectedAddressId}
              onClick={() => setStep('delivery')}
            >
              Deliver to this address
            </button>
          )}
        </div>
      )}

      {step === 'delivery' && (
        <div className="checkout-step">
          <p className="checkout-step__heading">Choose delivery option</p>
          {courierLoading && <p className="checkout-loading">Finding couriers…</p>}
          {courierError && <p className="checkout-form-error">{courierError}</p>}
          {!courierLoading && !courierError && couriers.length === 0 && (
            <p className="checkout-loading">No couriers available for this address.</p>
          )}
          <div className="checkout-courier-list">
            {couriers.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`checkout-courier-card${selectedCourierId === c.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedCourierId(c.id)}
              >
                <span className={`checkout-address-card__radio${selectedCourierId === c.id ? ' is-checked' : ''}`} aria-hidden="true" />
                <span className="checkout-courier-card__body">
                  <span className="checkout-courier-card__name">{c.name}</span>
                  <span className="checkout-courier-card__meta">Arrives {formatEtaDate(c.etaDays)}</span>
                  <span className={`checkout-courier-card__meta${c.codAvailable ? '' : ' is-muted'}`}>
                    {c.codAvailable ? 'COD available' : 'COD not available'}
                  </span>
                </span>
                <PriceTag priceINR={c.feeINR} size="sm" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block checkout-step__cta"
            disabled={!selectedCourierId}
            onClick={() => setStep('payment')}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'payment' && (
        <>
          <div className="checkout-card">
            <div className="checkout-row">
              <span className="checkout-row__label">Item price</span>
              <PriceTag priceINR={itemINR} size="sm" />
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">SPOTTED Buyer Protection</span>
              <PriceTag priceINR={protectionFee} size="sm" />
            </div>
            <div className="checkout-row">
              <span className="checkout-row__label">Shipping ({selectedCourier?.name})</span>
              <PriceTag priceINR={shippingFee} size="sm" />
            </div>
            {payMethod === 'cod' && (
              <div className="checkout-row">
                <span className="checkout-row__label">COD fee</span>
                <PriceTag priceINR={codFee} size="sm" />
              </div>
            )}
            <div className="checkout-row checkout-row--total">
              <span className="checkout-row__label">Total</span>
              <PriceTag priceINR={total} size="md" />
            </div>
          </div>

          <div className="checkout-sheet">
            <p className="checkout-sheet__heading">Choose payment method</p>

            <button
              type="button"
              className={`checkout-method${payMethod === 'upi' ? ' is-selected' : ''}`}
              onClick={() => setPayMethod('upi')}
            >
              <span className="checkout-method__icon" aria-hidden="true">📲</span>
              <span className="checkout-method__label">UPI</span>
              <span className={`checkout-method__radio${payMethod === 'upi' ? ' is-checked' : ''}`} aria-hidden="true" />
            </button>
            {payMethod === 'upi' && (
              <div className="checkout-upi-row">
                {UPI_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={`checkout-upi-chip${selectedUpiApp === app.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedUpiApp(app.id)}
                  >
                    <span aria-hidden="true">{app.emoji}</span>
                    {app.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className={`checkout-method${payMethod === 'card' ? ' is-selected' : ''}`}
              onClick={() => setPayMethod('card')}
            >
              <span className="checkout-method__icon" aria-hidden="true">💳</span>
              <span className="checkout-method__label">Credit / Debit card</span>
              <span className={`checkout-method__radio${payMethod === 'card' ? ' is-checked' : ''}`} aria-hidden="true" />
            </button>
            {payMethod === 'card' && (
              <div className="checkout-card-fields">
                <input className="input" placeholder="Card number" inputMode="numeric" disabled />
                <div className="checkout-card-fields__row">
                  <input className="input" placeholder="MM/YY" disabled />
                  <input className="input" placeholder="CVV" disabled />
                </div>
                <p className="checkout-sandbox-hint">Sandbox mode — no real card is charged.</p>
              </div>
            )}

            <button
              type="button"
              className={`checkout-method${payMethod === 'cod' ? ' is-selected' : ''}`}
              onClick={() => selectedCourier?.codAvailable && setPayMethod('cod')}
              disabled={!selectedCourier?.codAvailable}
            >
              <span className="checkout-method__icon" aria-hidden="true">💵</span>
              <span className="checkout-method__label">Cash on Delivery</span>
              <span className={`checkout-method__radio${payMethod === 'cod' ? ' is-checked' : ''}`} aria-hidden="true" />
            </button>
            {!selectedCourier?.codAvailable && (
              <p className="checkout-cod-note">COD isn't available with {selectedCourier?.name ?? 'this courier'} for your address.</p>
            )}

            {placeError && <p className="checkout-place-error">{placeError}</p>}
            <button
              type="button"
              className="btn btn-primary btn-block checkout-pay-btn"
              onClick={handlePlaceOrder}
              disabled={placing}
            >
              {placing ? 'Placing order…' : `Place order · ${formatINR(total)}`}
            </button>
            <p className="checkout-razorpay-note">Payments by Razorpay — sandbox</p>
          </div>
        </>
      )}

      <CheckoutStyles />
    </div>
  );
}

// Screen-scoped styles kept local to this file per file-ownership rules.
function CheckoutStyles() {
  return (
    <style>{`
      .checkout-page {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-bottom: 24px;
      }

      .checkout-stepper {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 16px;
      }

      .checkout-stepper__item {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
      }

      .checkout-stepper__dot {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 1.5px solid var(--hairline);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-2);
      }

      .checkout-stepper__item.is-active .checkout-stepper__dot {
        border-color: var(--accent);
        color: var(--accent);
      }

      .checkout-stepper__item.is-done .checkout-stepper__dot {
        border-color: var(--good);
        background: var(--good);
        color: #fff;
      }

      .checkout-stepper__label {
        font-size: 11px;
        color: var(--ink-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .checkout-stepper__item.is-active .checkout-stepper__label {
        color: var(--ink);
        font-weight: 700;
      }

      .checkout-summary {
        display: flex;
        gap: 12px;
        padding: 16px;
      }

      .checkout-summary__tile {
        width: 72px;
        height: 72px;
        border-radius: var(--radius);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        overflow: hidden;
      }

      .checkout-summary__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .checkout-summary__info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        justify-content: center;
        min-width: 0;
      }

      .checkout-summary__title {
        font-size: 15px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .checkout-summary__meta {
        font-size: 13px;
        color: var(--ink-2);
      }

      .checkout-step {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 0 16px;
      }

      .checkout-step__heading {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-2);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .checkout-step__cta {
        margin-top: 4px;
      }

      .checkout-address-list, .checkout-courier-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkout-address-card, .checkout-courier-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--hairline);
        background: var(--surface);
        text-align: left;
      }

      .checkout-courier-card {
        align-items: center;
      }

      .checkout-address-card.is-selected, .checkout-courier-card.is-selected {
        border-color: var(--accent);
        background: rgba(255, 35, 0, 0.05);
      }

      .checkout-address-card__radio {
        width: 16px;
        height: 16px;
        margin-top: 3px;
        border-radius: 50%;
        border: 1.5px solid var(--hairline);
        flex-shrink: 0;
      }

      .checkout-address-card__radio.is-checked {
        border-color: var(--accent);
        border-width: 5px;
      }

      .checkout-address-card__body, .checkout-courier-card__body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }

      .checkout-address-card__name {
        font-size: 14px;
        font-weight: 700;
      }

      .checkout-address-card__lines {
        font-size: 13px;
        color: var(--ink-2);
      }

      .checkout-courier-card__name {
        font-size: 14px;
        font-weight: 700;
      }

      .checkout-courier-card__meta {
        font-size: 12px;
        color: var(--good);
      }

      .checkout-courier-card__meta.is-muted {
        color: var(--ink-2);
      }

      .checkout-address-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .checkout-phone-field {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .checkout-phone-prefix {
        padding: 13px 10px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--hairline);
        background: var(--bg);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink-2);
      }

      .checkout-form-row {
        display: flex;
        gap: 8px;
      }

      .checkout-pin-note {
        font-size: 13px;
        color: var(--ink-2);
        margin-top: -4px;
      }

      .checkout-pin-note--ok {
        color: var(--good);
        font-weight: 600;
      }

      .checkout-pin-note--error {
        color: var(--warn);
        font-weight: 600;
      }

      .checkout-form-error {
        font-size: 13px;
        font-weight: 600;
        color: var(--warn);
      }

      .checkout-form-actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      .checkout-loading {
        font-size: 13px;
        color: var(--ink-2);
      }

      .checkout-cod-note {
        font-size: 12px;
        color: var(--warn);
        margin-top: -6px;
      }

      .checkout-returns-note {
        font-size: 13px;
        color: var(--good);
        font-weight: 600;
      }

      .checkout-card {
        margin: 0 16px;
        padding: 14px 16px;
        border-radius: var(--radius);
        background: var(--bg);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .checkout-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .checkout-row__label {
        font-size: 14px;
        color: var(--ink-2);
      }

      .checkout-row__value {
        font-size: 14px;
        font-weight: 600;
      }

      .checkout-row__value--mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
      }

      .checkout-row--total {
        padding-top: 10px;
        border-top: 1px dashed var(--hairline);
      }

      .checkout-row--total .checkout-row__label {
        font-weight: 700;
        color: var(--ink);
      }

      /* ---- Razorpay-style payment sheet ---- */

      .checkout-sheet {
        margin-top: auto;
        padding: 18px 16px 20px;
        border-top: 1px solid var(--hairline);
        background: var(--surface);
        border-radius: 20px 20px 0 0;
        box-shadow: 0 -8px 24px rgba(17, 17, 17, 0.06);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .checkout-sheet__heading {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-2);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-bottom: 2px;
      }

      .checkout-method {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 13px 14px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--hairline);
        background: var(--surface);
        text-align: left;
      }

      .checkout-method.is-selected {
        border-color: var(--accent);
        background: rgba(255, 35, 0, 0.05);
      }

      .checkout-method:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .checkout-method__icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      .checkout-method__label {
        flex: 1;
        font-size: 14px;
        font-weight: 600;
      }

      .checkout-method__radio {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 1.5px solid var(--hairline);
        flex-shrink: 0;
      }

      .checkout-method__radio.is-checked {
        border-color: var(--accent);
        border-width: 5px;
      }

      .checkout-upi-row {
        display: flex;
        gap: 8px;
        padding: 2px 2px 8px;
        overflow-x: auto;
      }

      .checkout-upi-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 9px 14px;
        border-radius: 999px;
        border: 1.5px solid var(--hairline);
        background: var(--surface);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }

      .checkout-upi-chip.is-selected {
        border-color: var(--accent);
        background: var(--accent);
        color: #fff;
      }

      .checkout-card-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 2px 2px 8px;
      }

      .checkout-card-fields__row {
        display: flex;
        gap: 8px;
      }

      .checkout-sandbox-hint {
        font-size: 12px;
        color: var(--ink-2);
      }

      .checkout-place-error {
        font-size: 13px;
        font-weight: 600;
        color: var(--warn);
        text-align: center;
      }

      .checkout-pay-btn {
        margin-top: 6px;
      }

      .checkout-razorpay-note {
        text-align: center;
        font-size: 11px;
        color: var(--ink-2);
        margin-top: 2px;
      }

      /* ---- Success state ---- */

      .checkout-success {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
        padding: 40px 24px;
      }

      .checkout-success__badge {
        font-size: 48px;
      }

      .checkout-success__title {
        font-size: 20px;
      }

      .checkout-success__sub {
        font-size: 14px;
        color: var(--ink-2);
        max-width: 320px;
      }

      .checkout-success__card {
        width: 100%;
        margin: 14px 0 4px;
        background: var(--bg);
      }

      .checkout-success__actions {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 12px;
      }
    `}</style>
  );
}
