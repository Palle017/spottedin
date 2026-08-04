import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { codFeeINR, orderTotalINR, protectionFeeINR, toPaise } from '../src/services/checkoutMath.ts';
import {
  protectionFeeINR as serverProtectionFeeINR,
  toPaise as serverToPaise,
} from '../supabase/functions/_shared/payment_checks.ts';

describe('checkout money math', () => {
  it('total = item + protection + shipping (+ COD fee only for COD)', () => {
    assert.equal(orderTotalINR(1000, 49, 'upi'), 1000 + 20 + 49);
    assert.equal(orderTotalINR(1000, 49, 'cod'), 1000 + 20 + 49 + 40);
  });

  it('COD fee applies only to COD', () => {
    assert.equal(codFeeINR('cod'), 40);
    assert.equal(codFeeINR('upi'), 0);
    assert.equal(codFeeINR('card'), 0);
  });
});

describe('client/server fee parity', () => {
  it('protection fee matches the Edge Function for representative prices', () => {
    for (const price of [1, 100, 749, 750, 751, 1499, 8999, 15999]) {
      assert.equal(protectionFeeINR(price), serverProtectionFeeINR(price));
    }
  });

  it('paise conversion matches the Edge Function', () => {
    assert.equal(toPaise(1499), serverToPaise(1499));
    assert.throws(() => toPaise(10.5));
    assert.throws(() => serverToPaise(10.5));
  });
});
