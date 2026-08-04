// The payment Edge Function re-quotes shipping with a server-side copy of the
// client quote table. If the copies drift, the server would reject couriers
// the client offered (or worse, price them differently). This test pins them
// byte-for-byte across representative pincodes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quoteCouriers as clientQuote, checkPincodeServiceability } from '../src/lib/courierQuotes.ts';
import { quoteCouriers as serverQuote } from '../supabase/functions/_shared/shipping_quote.ts';

const PINS = [
  '110001', // Delhi metro
  '400001', // Mumbai metro
  '560001', // Bengaluru metro
  '600042', // Chennai metro
  '700016', // Kolkata metro
  '500081', // Hyderabad metro
  '302001', // Jaipur non-metro
  '682001', // Kochi non-metro
  '226001', // Lucknow non-metro
  '110055', // unserviceable suffix
  '012345', // invalid leading zero
  '1100',   // invalid length
];

describe('shipping quote parity (client vs Edge Function)', () => {
  for (const pin of PINS) {
    it(`quotes identically for ${pin}`, () => {
      assert.deepEqual(serverQuote(pin), clientQuote(pin));
    });
  }

  it('unserviceable pins quote no couriers', () => {
    assert.equal(checkPincodeServiceability('110055').serviceable, false);
    assert.deepEqual(serverQuote('110055'), []);
  });

  it('shipping fees are integer rupees (Razorpay amounts are integer paise)', () => {
    for (const pin of PINS) {
      for (const quote of serverQuote(pin)) {
        assert.ok(Number.isInteger(quote.feeINR) && quote.feeINR > 0);
      }
    }
  });
});
