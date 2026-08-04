// Razorpay webhook receiver.
//
//  - Raw-body HMAC verification BEFORE parsing; constant-time compare.
//  - Deduplicated on x-razorpay-event-id via provider_events unique index.
//  - payment.captured / order.paid finalize an order ONLY when the payment's
//    amount and currency match the order exactly (paymentMatchesOrder) — the
//    verify-payment browser path and this path enforce the same rule.
//  - An amount/currency mismatch is recorded as payment_conflict for the
//    reconciliation runbook, never silently accepted or dropped.

import { errorResponse, HttpError, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { verifyRazorpayWebhook } from '../_shared/razorpay.ts';
import { mapTransferStatus, paymentMatchesOrder } from '../_shared/payment_checks.ts';
import { ensureHeldSellerTransfer } from '../_shared/route.ts';

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') ?? '';
    const eventId = request.headers.get('x-razorpay-event-id') ?? '';
    if (!signature || !eventId || !await verifyRazorpayWebhook(rawBody, signature)) {
      throw new HttpError(401, 'Invalid webhook signature');
    }
    const payload = JSON.parse(rawBody) as Record<string, any>;
    const eventType = String(payload.event ?? '');
    const admin = adminClient();
    const { error: eventError } = await admin.from('provider_events').insert({
      provider: 'razorpay',
      event_id: eventId,
      event_type: eventType,
      payload,
    });
    if (eventError?.code === '23505') {
      const { data: existing } = await admin.from('provider_events')
        .select('processed_at')
        .eq('provider', 'razorpay')
        .eq('event_id', eventId)
        .single();
      if (existing?.processed_at) return json({ duplicate: true });
    } else if (eventError) {
      throw eventError;
    }

    const payment = payload.payload?.payment?.entity ?? {};
    const providerOrderId = String(payment.order_id ?? payload.payload?.order?.entity?.id ?? '');
    const paymentId = String(payment.id ?? '');
    if (providerOrderId) {
      const { data: order } = await admin
        .from('commerce_orders')
        .select('id,razorpay_order_id,total_inr,status')
        .eq('razorpay_order_id', providerOrderId)
        .maybeSingle();
      if (order && (eventType === 'payment.captured' || eventType === 'order.paid')) {
        if (!paymentMatchesOrder(payment, order)) {
          // Signature-valid event whose money details do not match our order:
          // park the order for manual reconciliation, do not mark it paid.
          await admin.from('commerce_orders')
            .update({ status: 'payment_conflict' })
            .eq('id', order.id)
            .in('status', ['payment_pending', 'payment_authorized']);
          await admin.from('provider_events')
            .update({
              processed_at: new Date().toISOString(),
              processing_error: 'Payment amount/currency does not match the order',
            })
            .eq('provider', 'razorpay')
            .eq('event_id', eventId);
          return json({ received: true, conflict: true });
        }
        const { data: finalStatus, error: finalizeError } = await admin.rpc('finalize_paid_commerce_order', {
          target_order_id: order.id,
          target_payment_id: paymentId,
        });
        if (finalizeError) throw finalizeError;
        if (finalStatus === 'paid') {
          await ensureHeldSellerTransfer(order.id).catch((transferError: unknown) => {
            console.error('Could not create held seller transfer', transferError);
          });
        }
      } else if (order && eventType === 'payment.failed') {
        await admin.from('commerce_orders')
          .update({ status: 'payment_failed', razorpay_payment_id: paymentId || null })
          .eq('id', order.id)
          .in('status', ['payment_pending', 'payment_authorized']);
      }
    }

    const transfer = payload.payload?.transfer?.entity ?? {};
    const transferId = String(transfer.id ?? '');
    if (transferId) {
      const mapped = mapTransferStatus(String(transfer.status ?? ''), Boolean(transfer.on_hold));
      await admin.from('route_transfers').update({
        // An unrecognized provider status ('creating') must not clobber a
        // terminal or needs_reconciliation state; settlement fields are
        // provider-authoritative either way.
        ...(mapped === 'creating' ? {} : { status: mapped }),
        settlement_status: transfer.settlement_status ?? null,
        on_hold: Boolean(transfer.on_hold),
        last_error: transfer.error?.description ?? null,
      }).eq('razorpay_transfer_id', transferId);
    }
    await admin.from('provider_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'razorpay')
      .eq('event_id', eventId);
    return json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
});
