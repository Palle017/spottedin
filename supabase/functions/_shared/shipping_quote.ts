// Server-side copy of src/lib/courierQuotes.ts so create-payment-order can
// re-quote shipping deterministically without trusting the browser and
// WITHOUT any shipping-provider (Shiprocket) call in the payment path.
// Keep byte-equivalent logic with the client module —
// tests/shipping_quote_parity.test.ts fails on drift.

export interface CourierQuoteData {
  id: string;
  name: string;
  etaDays: number;
  feeINR: number;
  codAvailable: boolean;
}

const PIN_RE = /^[1-9]\d{5}$/;
const METRO_PREFIXES = ['11', '40', '56', '60', '70', '50'];

function seedFromPin(pin: string): number {
  let n = 0;
  for (let i = 0; i < pin.length; i++) n = (n * 31 + pin.charCodeAt(i)) % 1000;
  return n;
}

function serviceable(pin: string): boolean {
  return PIN_RE.test(pin) && !pin.endsWith('55');
}

export function quoteCouriers(pin: string): CourierQuoteData[] {
  if (!serviceable(pin)) return [];

  const seed = seedFromPin(pin);
  const isMetro = METRO_PREFIXES.includes(pin.slice(0, 2));

  if (isMetro) {
    return [
      { id: 'delhivery', name: 'Delhivery', etaDays: 2 + (seed % 3), feeINR: 49 + (seed % 51), codAvailable: true },
      { id: 'ekart', name: 'Ekart', etaDays: 2 + ((seed + 1) % 3), feeINR: 49 + ((seed + 7) % 51), codAvailable: true },
      { id: 'bluedart', name: 'Blue Dart', etaDays: 2 + ((seed + 2) % 3), feeINR: 49 + ((seed + 13) % 51), codAvailable: true },
    ];
  }

  return [
    { id: 'delhivery', name: 'Delhivery', etaDays: 4 + (seed % 4), feeINR: 79 + (seed % 51), codAvailable: true },
    { id: 'indiapost', name: 'India Post', etaDays: 4 + ((seed + 2) % 4), feeINR: 79 + ((seed + 11) % 51), codAvailable: false },
  ];
}
