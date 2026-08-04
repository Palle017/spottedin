// Razorpay REST client for the payment path only. Deliberately omitted:
// Linked Account creation (v2 /accounts) and settlement-hold release
// (PATCH /transfers) — seller onboarding and payout release are operator
// actions performed in the Razorpay Dashboard until the release policy is
// approved. Shipping only the APIs the flow uses keeps the attack surface
// and the review surface small.

import { HttpError } from './http.ts';
import { hmacSha256Hex, timingSafeEqualHex } from './crypto.ts';

const API = 'https://api.razorpay.com/v1';

export function assertRazorpayOrderCreationEnabled(): void {
  if (Deno.env.get('RAZORPAY_PAYMENTS_ENABLED')?.trim().toLowerCase() !== 'true') {
    throw new HttpError(503, 'Razorpay payment creation is disabled');
  }
}

function credentials(): { keyId: string; keySecret: string } {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keyId || !keySecret) throw new HttpError(503, 'Razorpay is not configured on this server');
  return { keyId, keySecret };
}

async function request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    // A definitive provider rejection: the request reached Razorpay and was
    // refused. Distinguished from ambiguous network failures by callers that
    // must fail closed (see route.ts).
    console.error(`Razorpay rejected ${path} with status ${response.status}`);
    throw new HttpError(502, `Razorpay rejected the request (${response.status})`);
  }
  return payload;
}

export function razorpayKeyId(): string {
  return credentials().keyId;
}

export function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
}

export function fetchRazorpayPayment(paymentId: string) {
  return request(`/payments/${encodeURIComponent(paymentId)}`);
}

export function createHeldRouteTransfer(input: {
  paymentId: string;
  accountId: string;
  amountPaise: number;
  notes: Record<string, string>;
}) {
  return request(`/payments/${encodeURIComponent(input.paymentId)}/transfers`, {
    method: 'POST',
    body: JSON.stringify({
      transfers: [{
        account: input.accountId,
        amount: input.amountPaise,
        currency: 'INR',
        notes: input.notes,
        linked_account_notes: Object.keys(input.notes),
        on_hold: true,
      }],
    }),
  });
}

export async function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(credentials().keySecret, `${orderId}|${paymentId}`);
  return timingSafeEqualHex(expected, signature);
}

export async function verifyRazorpayWebhook(rawBody: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')?.trim();
  if (!secret) throw new HttpError(503, 'Razorpay webhook secret is not configured');
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(expected, signature);
}
