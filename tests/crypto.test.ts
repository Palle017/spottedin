import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hmacSha256Hex, timingSafeEqualHex } from '../supabase/functions/_shared/crypto.ts';

describe('hmacSha256Hex', () => {
  it('matches the RFC 4231 test vector', async () => {
    // RFC 4231 test case 2: key "Jefe", data "what do ya want for nothing?"
    assert.equal(
      await hmacSha256Hex('Jefe', 'what do ya want for nothing?'),
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('signs the Razorpay checkout message shape', async () => {
    const signature = await hmacSha256Hex('key_secret', 'order_ABC|pay_XYZ');
    assert.match(signature, /^[0-9a-f]{64}$/);
    assert.equal(signature, await hmacSha256Hex('key_secret', 'order_ABC|pay_XYZ'));
    assert.notEqual(signature, await hmacSha256Hex('key_secret', 'order_ABC|pay_ZZZ'));
  });
});

describe('timingSafeEqualHex', () => {
  it('accepts equal hex strings', () => {
    assert.equal(timingSafeEqualHex('deadbeef', 'deadbeef'), true);
  });

  it('rejects different values and different lengths', () => {
    assert.equal(timingSafeEqualHex('deadbeef', 'deadbeee'), false);
    assert.equal(timingSafeEqualHex('deadbeef', 'deadbee'), false);
    assert.equal(timingSafeEqualHex('', 'ab'), false);
  });
});
