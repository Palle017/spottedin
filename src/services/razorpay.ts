// Razorpay Standard Checkout wiring behind the PaymentProvider seam.
// Only the public key id and provider order id ever reach the browser; every
// amount is computed server-side by the create-payment-order Edge Function.
// Nothing here runs unless the Supabase backend is configured.

import { getSupabase } from '../data/backend/supabaseClient';
import type { Address } from '../data/types';

export interface PaymentOrder {
  commerceOrderId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: 'INR';
  name: string;
  description: string;
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, callback: (value: unknown) => void): void;
    };
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const payload = await response.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof payload?.error === 'string') throw new Error(payload.error);
    }
    throw error;
  }
  return data as T;
}

export function createPaymentOrder(
  listingId: string,
  courierId: string,
  shippingAddress: Address,
): Promise<PaymentOrder> {
  return invoke('create-payment-order', {
    listingId,
    courierId,
    shippingAddress: {
      fullName: shippingAddress.fullName,
      phone: shippingAddress.phone,
      line1: shippingAddress.line1,
      line2: shippingAddress.line2 ?? '',
      landmark: shippingAddress.landmark ?? '',
      pincode: shippingAddress.pincode,
      city: shippingAddress.city,
      state: shippingAddress.state,
    },
  });
}

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-spotted-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.spottedRazorpay = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  order: PaymentOrder,
  prefill: { name: string; contact: string },
): Promise<RazorpaySuccess> {
  await loadRazorpayCheckout();
  if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable');
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.razorpayKeyId,
      amount: order.amountPaise,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.razorpayOrderId,
      prefill,
      modal: {
        confirm_close: true,
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
      handler: (response: RazorpaySuccess) => resolve(response),
    });
    checkout.on('payment.failed', () => reject(new Error('Payment failed')));
    checkout.open();
  });
}

export function verifyPayment(
  commerceOrderId: string,
  result: RazorpaySuccess,
): Promise<{ status: string }> {
  return invoke('verify-payment', {
    commerceOrderId,
    razorpayOrderId: result.razorpay_order_id,
    razorpayPaymentId: result.razorpay_payment_id,
    razorpaySignature: result.razorpay_signature,
  });
}
