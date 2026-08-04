// PaymentProvider seam. Mock by default; when the Supabase backend is
// configured AND the caller supplies checkout context, prepaid payments run
// through Razorpay Standard Checkout via the Edge Functions (server-side
// amounts, HMAC + amount verification). COD never touches Razorpay.

import { isBackendEnabled } from '../data/backend/supabaseClient';
import { createPaymentOrder, openRazorpayCheckout, verifyPayment } from './razorpay';
import type { Address, PayMethod } from '../data/types';

export interface PaymentRequest {
  amountINR: number;
  method: PayMethod;
  upiApp?: string;
  /** Server-verified checkout context; without it the mock provider runs. */
  checkout?: {
    listingId: string;
    courierId: string;
    address: Address;
  };
}

export type PaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string };

export interface PaymentProvider {
  createPayment(req: PaymentRequest): Promise<PaymentResult>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function mockPayment(req: PaymentRequest): Promise<PaymentResult> {
  if (req.method === 'cod') {
    return { ok: true, paymentId: 'cod' };
  }
  await delay(700);
  const paymentId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { ok: true, paymentId };
}

async function razorpayPayment(
  checkout: NonNullable<PaymentRequest['checkout']>,
): Promise<PaymentResult> {
  try {
    const order = await createPaymentOrder(checkout.listingId, checkout.courierId, checkout.address);
    const success = await openRazorpayCheckout(order, {
      name: checkout.address.fullName,
      contact: checkout.address.phone,
    });
    const { status } = await verifyPayment(order.commerceOrderId, success);
    if (status === 'paid') {
      return { ok: true, paymentId: success.razorpay_payment_id };
    }
    if (status === 'payment_authorized') {
      // Not captured yet — do not hand out the item. The webhook finalizes
      // capture; uncaptured authorizations lapse and auto-refund at Razorpay.
      return { ok: false, error: 'Payment is still processing. If money was deducted it will be refunded automatically.' };
    }
    return { ok: false, error: 'Payment could not be verified.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Payment failed.' };
  }
}

export const payments: PaymentProvider = {
  async createPayment(req) {
    const razorpayMode = import.meta.env.VITE_PAYMENT_MODE === 'razorpay';
    if (req.method !== 'cod' && req.checkout && isBackendEnabled() && razorpayMode) {
      return razorpayPayment(req.checkout);
    }
    return mockPayment(req);
  },
};
