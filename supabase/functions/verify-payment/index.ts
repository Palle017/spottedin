// Browser-initiated payment verification after Razorpay Checkout succeeds.
// The checkout HMAC alone is not sufficient: the payment is re-fetched from
// Razorpay and its order id, amount, and currency must match our order.
//
// Authorized-but-not-captured payments: this backend NEVER calls the capture
// API. Uncaptured authorizations lapse at Razorpay's capture window and are
// auto-refunded — that is the void strategy (see RAZORPAY_ROUTE.md).

import { corsHeaders, errorResponse, handleOptions, HttpError, json } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { fetchRazorpayPayment, verifyCheckoutSignature } from '../_shared/razorpay.ts';
import { paymentMatchesOrder } from '../_shared/payment_checks.ts';
import { ensureHeldSellerTransfer } from '../_shared/route.ts';

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const options = handleOptions(request);
  if (options) return options;
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    const user = await requireUser(request);
    const body = await request.json() as {
      commerceOrderId?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };
    if (!body.commerceOrderId || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      throw new HttpError(400, 'Invalid payment verification request');
    }
    const admin = adminClient();
    const { data: order, error } = await admin
      .from('commerce_orders')
      .select('*')
      .eq('id', body.commerceOrderId)
      .eq('buyer_id', user.id)
      .eq('razorpay_order_id', body.razorpayOrderId)
      .single();
    if (error || !order) throw new HttpError(403, 'Payment order does not belong to this user');
    if (!await verifyCheckoutSignature(
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
    )) throw new HttpError(403, 'Invalid Razorpay signature');

    const payment = await fetchRazorpayPayment(body.razorpayPaymentId);
    if (!paymentMatchesOrder(payment, order)) {
      throw new HttpError(403, 'Razorpay payment details do not match the order');
    }

    if (payment.status === 'captured') {
      const { data: finalStatus, error: finalizeError } = await admin.rpc(
        'finalize_paid_commerce_order',
        { target_order_id: order.id, target_payment_id: body.razorpayPaymentId },
      );
      if (finalizeError) throw finalizeError;
      if (finalStatus === 'paid') {
        await ensureHeldSellerTransfer(order.id).catch((transferError: unknown) => {
          console.error('Could not create held seller transfer', transferError);
        });
      }
      return json({ status: finalStatus }, finalStatus === 'paid' ? 200 : 409, cors);
    }
    if (payment.status === 'authorized') {
      await admin.from('commerce_orders')
        .update({
          status: 'payment_authorized',
          razorpay_payment_id: body.razorpayPaymentId,
        })
        .eq('id', order.id)
        .in('status', ['payment_pending']);
      return json({ status: 'payment_authorized' }, 202, cors);
    }
    await admin.from('commerce_orders')
      .update({ status: 'payment_failed' })
      .eq('id', order.id)
      .in('status', ['payment_pending', 'payment_authorized']);
    return json({ status: 'payment_failed' }, 402, cors);
  } catch (error) {
    return errorResponse(error, cors);
  }
});
