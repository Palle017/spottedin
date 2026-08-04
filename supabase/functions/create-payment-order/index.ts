// Creates a locked commerce order and the matching Razorpay order.
//
// Shipping is quoted by the deterministic in-repo quote table
// (_shared/shipping_quote.ts) — no shipping-provider API in the payment path.
// The browser sends only ids and the delivery address; every amount is
// recomputed server-side.

import { corsHeaders, errorResponse, handleOptions, HttpError, json } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { quoteCouriers } from '../_shared/shipping_quote.ts';
import { protectionFeeINR, toPaise } from '../_shared/payment_checks.ts';
import {
  assertRazorpayOrderCreationEnabled,
  createRazorpayOrder,
  razorpayKeyId,
} from '../_shared/razorpay.ts';

interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
}

function text(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim())) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  if (value.trim().length > max) throw new HttpError(400, `Invalid ${field}`);
  return value.trim();
}

function parseShippingAddress(value: unknown): ShippingAddress {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Invalid shipping address');
  const input = value as Record<string, unknown>;
  const phone = text(input.phone, 'phone', 13);
  const pincode = text(input.pincode, 'pincode', 6);
  if (!/^[6-9][0-9]{9}$/.test(phone.replace(/^\+91/, ''))) {
    throw new HttpError(400, 'Invalid Indian mobile number');
  }
  if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, 'Invalid Indian PIN code');
  return {
    fullName: text(input.fullName, 'name', 80),
    phone,
    line1: text(input.line1, 'address line 1', 180),
    line2: typeof input.line2 === 'string' ? input.line2.trim().slice(0, 180) : '',
    landmark: typeof input.landmark === 'string' ? input.landmark.trim().slice(0, 120) : '',
    pincode,
    city: text(input.city, 'city', 80),
    state: text(input.state, 'state', 80),
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const options = handleOptions(request);
  if (options) return options;
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    assertRazorpayOrderCreationEnabled();
    const user = await requireUser(request);
    const body = await request.json() as {
      listingId?: string;
      courierId?: string;
      shippingAddress?: unknown;
    };
    if (!body.listingId || typeof body.listingId !== 'string' || !body.courierId || typeof body.courierId !== 'string') {
      throw new HttpError(400, 'Invalid checkout request');
    }
    const address = parseShippingAddress(body.shippingAddress);
    const admin = adminClient();

    // Lapsed checkouts must not block a listing forever.
    await admin.from('commerce_orders')
      .update({ status: 'expired' })
      .eq('listing_id', body.listingId)
      .in('status', ['payment_pending', 'payment_authorized'])
      .lt('expires_at', new Date().toISOString());

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id,seller_id,title,price_inr,status')
      .eq('id', body.listingId)
      .single();
    if (listingError || !listing || listing.status !== 'live') {
      throw new HttpError(400, 'Listing is not available');
    }
    if (listing.seller_id === user.id) {
      throw new HttpError(403, 'Sellers cannot buy their own listing');
    }
    if (!Number.isInteger(listing.price_inr) || listing.price_inr <= 0) {
      throw new HttpError(400, 'Listing has no valid price');
    }

    const courier = quoteCouriers(address.pincode)
      .find((candidate) => candidate.id === body.courierId);
    if (!courier) throw new HttpError(400, 'Courier is not available for this address');

    const feeINR = protectionFeeINR(listing.price_inr);
    const totalINR = listing.price_inr + feeINR + courier.feeINR;
    const { data: order, error: orderError } = await admin
      .from('commerce_orders')
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        item_price_inr: listing.price_inr,
        platform_fee_inr: feeINR,
        shipping_fee_inr: courier.feeINR,
        total_inr: totalINR,
        shipping_address: address,
        courier_id: courier.id,
        courier_name: courier.name,
      })
      .select('*')
      .single();
    if (orderError || !order) {
      if (orderError?.code === '23505') {
        throw new HttpError(409, 'Another checkout is active for this listing');
      }
      throw orderError ?? new HttpError(500, 'Could not create checkout order');
    }

    try {
      const providerOrder = await createRazorpayOrder({
        amountPaise: toPaise(totalINR),
        receipt: `spotted_${order.id.replaceAll('-', '').slice(0, 32)}`,
        notes: { commerce_order_id: order.id, listing_id: listing.id },
      });
      const providerOrderId = String(providerOrder.id ?? '');
      if (!providerOrderId) throw new HttpError(502, 'Razorpay returned no order ID');
      const { error: attachError } = await admin.from('commerce_orders')
        .update({ razorpay_order_id: providerOrderId })
        .eq('id', order.id);
      if (attachError) {
        throw new HttpError(500, 'Could not attach the provider order');
      }
      return json({
        commerceOrderId: order.id,
        razorpayOrderId: providerOrderId,
        razorpayKeyId: razorpayKeyId(),
        amountPaise: toPaise(totalINR),
        currency: 'INR',
        name: 'Spotted',
        description: listing.title,
      }, 200, cors);
    } catch (error) {
      await admin.from('commerce_orders').update({ status: 'payment_failed' }).eq('id', order.id);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, cors);
  }
});
