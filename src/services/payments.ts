// Phase 2: replace mock with Razorpay Checkout — same interface.

import type { PayMethod } from '../data/types';

export interface PaymentRequest {
  amountINR: number;
  method: PayMethod;
  upiApp?: string;
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

export const payments: PaymentProvider = {
  async createPayment(req) {
    if (req.method === 'cod') {
      return { ok: true, paymentId: 'cod' };
    }
    await delay(700);
    const paymentId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return { ok: true, paymentId };
  },
};
