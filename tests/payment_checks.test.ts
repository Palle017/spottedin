// Run with `npm test` (node --test, native TS type-stripping — no deps).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapTransferStatus,
  paymentMatchesOrder,
  protectionFeeINR,
  toPaise,
} from '../supabase/functions/_shared/payment_checks.ts';

const order = { razorpay_order_id: 'order_ABC123', total_inr: 1499 };
const payment = { order_id: 'order_ABC123', amount: 149900, currency: 'INR' };

describe('paymentMatchesOrder', () => {
  it('accepts a matching payment', () => {
    assert.equal(paymentMatchesOrder(payment, order), true);
  });

  it('rejects a mismatched provider order id', () => {
    assert.equal(paymentMatchesOrder({ ...payment, order_id: 'order_OTHER' }, order), false);
  });

  it('rejects a wrong amount', () => {
    assert.equal(paymentMatchesOrder({ ...payment, amount: 149800 }, order), false);
    assert.equal(paymentMatchesOrder({ ...payment, amount: 1499 }, order), false);
  });

  it('rejects a wrong currency', () => {
    assert.equal(paymentMatchesOrder({ ...payment, currency: 'USD' }, order), false);
  });

  it('rejects when our order never got a provider order id', () => {
    assert.equal(paymentMatchesOrder(payment, { razorpay_order_id: null, total_inr: 1499 }), false);
  });

  it('rejects a missing payment order id', () => {
    assert.equal(paymentMatchesOrder({ amount: 149900, currency: 'INR' }, order), false);
  });
});

describe('mapTransferStatus', () => {
  it('maps processed + on_hold to on_hold', () => {
    assert.equal(mapTransferStatus('processed', true), 'on_hold');
  });

  it('maps processed without hold to processed', () => {
    assert.equal(mapTransferStatus('processed', false), 'processed');
  });

  it('maps terminal provider states straight through', () => {
    assert.equal(mapTransferStatus('reversed', false), 'reversed');
    assert.equal(mapTransferStatus('partially_reversed', false), 'partially_reversed');
    assert.equal(mapTransferStatus('failed', false), 'failed');
  });

  it('maps unknown states to creating (caller must not clobber existing status)', () => {
    assert.equal(mapTransferStatus('surprise_state', true), 'creating');
  });
});

describe('protectionFeeINR', () => {
  it('floors at 15 INR', () => {
    assert.equal(protectionFeeINR(100), 15);
  });

  it('charges 2% above the floor', () => {
    assert.equal(protectionFeeINR(5000), 100);
  });
});

describe('toPaise', () => {
  it('converts whole rupees', () => {
    assert.equal(toPaise(1499), 149900);
  });

  it('rejects fractional or non-positive rupee amounts', () => {
    assert.throws(() => toPaise(14.5));
    assert.throws(() => toPaise(0));
    assert.throws(() => toPaise(-5));
  });
});
