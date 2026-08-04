// Pure checkout money math, shared between the checkout UI and the Razorpay
// wiring. Server-side equivalents live in the Edge Functions; the server
// always recomputes — these values are display/prefill only, never trusted.

export function protectionFeeINR(itemINR: number): number {
  return Math.max(15, Math.round(itemINR * 0.02));
}

export function codFeeINR(payMethod: string): number {
  return payMethod === 'cod' ? 40 : 0;
}

export function orderTotalINR(itemINR: number, shippingFeeINR: number, payMethod: string): number {
  return itemINR + protectionFeeINR(itemINR) + shippingFeeINR + codFeeINR(payMethod);
}

/** Razorpay amounts are integer paise. Rejects non-integer rupee inputs instead of rounding money. */
export function toPaise(amountINR: number): number {
  if (!Number.isInteger(amountINR) || amountINR <= 0) {
    throw new Error(`Invalid INR amount: ${amountINR}`);
  }
  return amountINR * 100;
}
