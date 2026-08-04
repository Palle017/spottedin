// Pure, deterministic courier quoting shared by the client shipping service
// and (as a byte-equivalent copy) the create-payment-order Edge Function, so
// the server re-quotes shipping without trusting the browser. Any change here
// must be mirrored in supabase/functions/_shared/shipping_quote.ts —
// tests/shipping_quote_parity.test.ts fails on drift.

export interface CourierQuoteData {
  id: string;
  name: string;
  etaDays: number;
  feeINR: number;
  codAvailable: boolean;
}

export interface ServiceabilityData {
  serviceable: boolean;
  city?: string;
  state?: string;
  codAvailable?: boolean;
}

const PIN_RE = /^[1-9]\d{5}$/;
const METRO_PREFIXES = ['11', '40', '56', '60', '70', '50'];

const STATE_BY_FIRST_DIGIT: Record<string, { city: string; state: string }> = {
  '1': { city: 'Delhi', state: 'Delhi' },
  '4': { city: 'Mumbai', state: 'Maharashtra' },
  '5': { city: 'Hyderabad', state: 'Telangana' },
  '6': { city: 'Chennai', state: 'Tamil Nadu' },
  '7': { city: 'Kolkata', state: 'West Bengal' },
};
const DEFAULT_LOCATION = { city: 'Bengaluru', state: 'Karnataka' };

function seedFromPin(pin: string): number {
  let n = 0;
  for (let i = 0; i < pin.length; i++) n = (n * 31 + pin.charCodeAt(i)) % 1000;
  return n;
}

export function checkPincodeServiceability(pin: string): ServiceabilityData {
  if (!PIN_RE.test(pin)) return { serviceable: false };
  if (pin.endsWith('55')) return { serviceable: false };

  const location = STATE_BY_FIRST_DIGIT[pin[0]] ?? DEFAULT_LOCATION;
  return { serviceable: true, city: location.city, state: location.state, codAvailable: true };
}

export function quoteCouriers(pin: string): CourierQuoteData[] {
  if (!checkPincodeServiceability(pin).serviceable) return [];

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
