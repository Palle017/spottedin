// Phase 2: replace mock with Shiprocket — same interface. All logic below is
// deterministic (no RNG) so demo runs are reproducible.

import { getOrders } from '../data/store';
import type { CourierQuote, Serviceability, TrackingEvent } from '../data/types';

export interface ShippingProvider {
  checkPincode(pin: string): Promise<Serviceability>;
  getCouriers(pin: string): Promise<CourierQuote[]>;
  createShipment(orderId: string): Promise<{ awb: string; courierName: string; labelUrl?: string }>;
  track(awb: string): Promise<TrackingEvent[]>;
}

const PIN_RE = /^[1-9]\d{5}$/;
const METRO_PREFIXES = ['11', '40', '56', '60', '70', '50'];

const STATE_BY_FIRST_DIGIT: Record<string, { city: string; state: string }> = {
  '1': { city: 'Delhi', state: 'Delhi' },
  '4': { city: 'Mumbai', state: 'Maharashtra' },
  '5': { city: 'Hyderabad', state: 'Telangana' },
  '6': { city: 'Chennai', state: 'Tamil Nadu' },
  '7': { city: 'Kolkata', state: 'West Bengal' },
};
const DEFAULT_LOCATION = { city: 'Bengaluru', state: 'Karnataka' };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function seedFromPin(pin: string): number {
  let n = 0;
  for (let i = 0; i < pin.length; i++) n = (n * 31 + pin.charCodeAt(i)) % 1000;
  return n;
}

function digitsFromString(input: string, length: number): string {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 * 31 + c) % 1_000_000_007;
    h2 = (h2 * 17 + c) % 998_244_353;
  }
  const combined = `${h1}${h2}`;
  return (combined + '0000000000').slice(0, length);
}

async function checkPincode(pin: string): Promise<Serviceability> {
  await delay(300);
  if (!PIN_RE.test(pin)) return { serviceable: false };
  if (pin.endsWith('55')) return { serviceable: false };

  const location = STATE_BY_FIRST_DIGIT[pin[0]] ?? DEFAULT_LOCATION;
  return { serviceable: true, city: location.city, state: location.state, codAvailable: true };
}

async function getCouriers(pin: string): Promise<CourierQuote[]> {
  await delay(400);
  const serviceability = await checkPincode(pin);
  if (!serviceability.serviceable) return [];

  const seed = seedFromPin(pin);
  const isMetro = METRO_PREFIXES.includes(pin.slice(0, 2));

  if (isMetro) {
    return [
      { id: 'delhivery', name: 'Delhivery', etaDays: 2 + (seed % 3), feeINR: 49 + (seed % 51), codAvailable: true },
      { id: 'ekart', name: 'Ekart', etaDays: 2 + ((seed + 1) % 3), feeINR: 49 + ((seed + 7) % 51), codAvailable: true },
      { id: 'bluedart', name: 'Blue Dart', etaDays: 2 + ((seed + 2) % 3), feeINR: 49 + ((seed + 13) % 51), codAvailable: true },
    ];
  }

  return [
    { id: 'delhivery', name: 'Delhivery', etaDays: 4 + (seed % 4), feeINR: 79 + (seed % 51), codAvailable: true },
    { id: 'indiapost', name: 'India Post', etaDays: 4 + ((seed + 2) % 4), feeINR: 79 + ((seed + 11) % 51), codAvailable: false },
  ];
}

async function createShipment(orderId: string): Promise<{ awb: string; courierName: string; labelUrl?: string }> {
  await delay(500);
  const order = getOrders().find((o) => o.id === orderId);
  const awb = `SPT${digitsFromString(orderId, 10)}`;
  return { awb, courierName: order?.courierName ?? 'Delhivery' };
}

async function track(awb: string): Promise<TrackingEvent[]> {
  await delay(300);
  const order = getOrders().find((o) => o.awb === awb);
  if (!order) return [];
  if (order.timeline?.length) return order.timeline;
  if (order.placedAt) return [{ status: 'placed', label: 'Order placed', at: order.placedAt }];
  return [];
}

export const shipping: ShippingProvider = { checkPincode, getCouriers, createShipment, track };
