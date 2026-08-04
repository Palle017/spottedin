// Pure verification helpers shared by verify-payment and razorpay-webhook.
// No Deno globals — unit-tested from tests/payment_checks.test.ts.

export interface OrderAmounts {
  razorpay_order_id: string | null;
  total_inr: number;
}

/**
 * A payment may only finalize an order when it references the same provider
 * order AND its amount/currency match exactly. Applied on BOTH the browser
 * verify path and the webhook path — a captured payment with the wrong
 * amount or currency must never mark an order paid.
 */
export function paymentMatchesOrder(
  payment: Record<string, unknown>,
  order: OrderAmounts,
): boolean {
  return (
    typeof payment.order_id === 'string'
    && order.razorpay_order_id !== null
    && payment.order_id === order.razorpay_order_id
    && Number(payment.amount) === order.total_inr * 100
    && payment.currency === 'INR'
  );
}

export type RouteTransferStatus =
  | 'on_hold'
  | 'processed'
  | 'reversed'
  | 'partially_reversed'
  | 'failed'
  | 'creating';

/** Maps Razorpay transfer webhook status onto our route_transfers states. */
export function mapTransferStatus(providerStatus: string, onHold: boolean): RouteTransferStatus {
  switch (providerStatus) {
    case 'processed':
      return onHold ? 'on_hold' : 'processed';
    case 'reversed':
      return 'reversed';
    case 'partially_reversed':
      return 'partially_reversed';
    case 'failed':
      return 'failed';
    default:
      return 'creating';
  }
}

export function protectionFeeINR(itemINR: number): number {
  return Math.max(15, Math.round(itemINR * 0.02));
}

/** Razorpay amounts are integer paise. Rejects non-integer rupees instead of rounding money. */
export function toPaise(amountINR: number): number {
  if (!Number.isInteger(amountINR) || amountINR <= 0) {
    throw new Error(`Invalid INR amount: ${amountINR}`);
  }
  return amountINR * 100;
}
