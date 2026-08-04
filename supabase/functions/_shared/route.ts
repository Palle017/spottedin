// Razorpay Route held-transfer creation. Fail-closed by construction:
//
//  - The DB row is claimed BEFORE the provider call (claim_route_transfer is
//    the idempotency lock), so two concurrent finalizations cannot create two
//    transfers.
//  - A definitive provider rejection (HttpError from razorpay.ts — Razorpay
//    answered with an error) marks the row 'failed'; it may be retried by an
//    operator after review.
//  - ANY ambiguous outcome — network failure where the request may have
//    reached Razorpay, or a DB failure after the provider accepted the
//    transfer — marks the row 'needs_reconciliation' and is NEVER retried
//    automatically. Money may have moved; only the reconciliation runbook
//    (RAZORPAY_ROUTE.md) may resolve it.

import { adminClient } from './supabase.ts';
import { HttpError } from './http.ts';
import { createHeldRouteTransfer } from './razorpay.ts';
import { toPaise } from './payment_checks.ts';

interface RouteTransferClaim {
  payout_id: string;
  payment_id: string;
  linked_account_id: string;
  amount_inr: number;
  acquired: boolean;
}

function transferEntity(payload: Record<string, unknown>): Record<string, unknown> {
  const items = payload.items;
  if (!Array.isArray(items) || !items[0] || typeof items[0] !== 'object') {
    throw new Error('Razorpay Route returned no transfer entity');
  }
  return items[0] as Record<string, unknown>;
}

async function markTransfer(
  payoutId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await adminClient().from('route_transfers').update(patch).eq('id', payoutId);
  if (error) {
    // Best-effort: the row keeps its claimed state; reconciliation runbook
    // covers rows stuck in 'creating'.
    console.error(`Could not update route_transfers ${payoutId}`, error);
  }
}

export async function ensureHeldSellerTransfer(orderId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.rpc('claim_route_transfer', {
    target_order_id: orderId,
  });
  if (error) throw error;
  const claim = (Array.isArray(data) ? data[0] : data) as RouteTransferClaim | null;
  if (!claim) return 'not_eligible';
  if (!claim.acquired) return 'already_recorded';

  let payload: Record<string, unknown>;
  try {
    payload = await createHeldRouteTransfer({
      paymentId: claim.payment_id,
      accountId: claim.linked_account_id,
      amountPaise: toPaise(claim.amount_inr),
      notes: { spotted_order_id: orderId },
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 502) {
      await markTransfer(claim.payout_id, {
        status: 'failed',
        last_error: error.message.slice(0, 1000),
      });
    } else {
      const message = error instanceof Error ? error.message : 'Ambiguous transfer failure';
      await markTransfer(claim.payout_id, {
        status: 'needs_reconciliation',
        last_error: `Provider outcome unknown: ${message}`.slice(0, 1000),
      });
    }
    throw error;
  }

  let transferId = '';
  try {
    const transfer = transferEntity(payload);
    transferId = String(transfer.id ?? '');
    if (!transferId) throw new Error('Razorpay Route returned no transfer ID');
    const settlementStatus = String(transfer.settlement_status ?? 'on_hold');
    const { error: updateError } = await admin.from('route_transfers').update({
      razorpay_transfer_id: transferId,
      status: 'on_hold',
      settlement_status: settlementStatus,
      on_hold: true,
      last_error: null,
    }).eq('id', claim.payout_id);
    if (updateError) throw updateError;
    return 'on_hold';
  } catch (error) {
    // Provider accepted the transfer but we could not record it — money has
    // moved at Razorpay. Fail closed: reconciliation only, never auto-retry.
    const message = error instanceof Error ? error.message : 'Could not record transfer';
    await markTransfer(claim.payout_id, {
      ...(transferId ? { razorpay_transfer_id: transferId } : {}),
      status: 'needs_reconciliation',
      last_error: `Transfer created at provider but not recorded: ${message}`.slice(0, 1000),
    });
    throw error;
  }
}
