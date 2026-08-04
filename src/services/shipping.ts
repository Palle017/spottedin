// Phase 2: replace mock with Shiprocket — same interface. All logic below is
// deterministic (no RNG) so demo runs are reproducible. Quote math lives in
// src/lib/courierQuotes.ts so the payment Edge Function can re-quote the same
// numbers server-side without a Shiprocket dependency.

import { getOrders } from '../data/store';
import { checkPincodeServiceability, quoteCouriers } from '../lib/courierQuotes';
import type { CourierQuote, Serviceability, TrackingEvent } from '../data/types';

export interface ShippingProvider {
  checkPincode(pin: string): Promise<Serviceability>;
  getCouriers(pin: string): Promise<CourierQuote[]>;
  createShipment(orderId: string): Promise<{ awb: string; courierName: string; labelUrl?: string }>;
  track(awb: string): Promise<TrackingEvent[]>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  return checkPincodeServiceability(pin);
}

async function getCouriers(pin: string): Promise<CourierQuote[]> {
  await delay(400);
  return quoteCouriers(pin);
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
