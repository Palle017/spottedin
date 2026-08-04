# Razorpay + Route integration (SPOTTED)

Status: implemented locally as Supabase SQL (`supabase/commerce_schema.sql`),
Edge Functions (`supabase/functions/`), and client wiring behind the existing
`PaymentProvider` seam (`src/services/payments.ts`). No provider account,
credential, webhook, payment, or transfer has been activated or tested against
live/sandbox Razorpay. Production money movement stays disabled and fail-closed
until every activation gate below is verified.

Order creation has two independent activation gates: browser
`VITE_PAYMENT_MODE=razorpay` and Edge Function secret
`RAZORPAY_PAYMENTS_ENABLED=true`. Credentials alone do not enable payments.

## Flow

1. `create-payment-order` authenticates the buyer, reloads the listing price
   from the database, re-quotes shipping with the deterministic in-repo quote
   table (`_shared/shipping_quote.ts` — **no shipping-provider API in the
   payment path**), computes the protection fee, inserts a locked
   `commerce_orders` row (one active checkout per listing), and creates the
   Razorpay order in paise.
2. The browser gets only the public key id + provider order id and opens
   Standard Checkout (`src/services/razorpay.ts`).
3. `verify-payment` checks the checkout HMAC (constant-time), re-fetches the
   payment from Razorpay, and requires provider order id, **amount, and
   currency** to match our order before finalizing.
4. `razorpay-webhook` verifies the raw-body HMAC before parsing, dedupes on
   `x-razorpay-event-id` (`provider_events` unique index), and applies the
   **same amount/currency check** before finalizing. A signature-valid event
   whose money details mismatch parks the order as `payment_conflict` — it is
   never accepted and never silently dropped.
5. `finalize_paid_commerce_order` (row-locked, SECURITY DEFINER) is the only
   path to `paid`; it atomically flips the listing `live -> sold`. Orders in
   `expired`/`cancelled` can never be finalized by a late capture — they park
   as `payment_conflict`.
6. After `paid`, `claim_route_transfer` idempotently claims the one held
   Route transfer for the item price to the seller's activated Linked Account
   (`on_hold: true`). Sellers without an activated payout account get a
   `seller_not_ready` row. Nothing releases money automatically.

## Deliberately omitted APIs

Linked Account creation (`POST /v2/accounts`) and settlement-hold release
(`PATCH /transfers/:id`) are **not** in this codebase. Seller onboarding/KYC
and payout release are operator actions in the Razorpay Dashboard until the
returns/disputes/release policy is approved. Code that can move or release
money must not exist before the policy that governs it.

## Authorized-payment expiry / void strategy

- Checkout orders expire 15 minutes after creation while `payment_pending`.
- This backend **never calls the capture API**. If Razorpay reports a payment
  as `authorized` (not captured), the order moves to `payment_authorized` and
  the buyer is told the payment is still processing.
- An authorization that is never captured lapses at Razorpay's capture window
  and is auto-refunded by Razorpay. That lapse **is** the void strategy — no
  code path captures a stale authorization.
- If a capture webhook later arrives for an order that already expired or was
  cancelled, `finalize_paid_commerce_order` refuses and parks the order as
  `payment_conflict` (refund runbook below).

## Reconciliation runbook (fail-closed states)

Nothing below is retried automatically. Run this checklist manually.

`route_transfers.status = 'needs_reconciliation'`
: The provider outcome is unknown (network failure mid-call) or Razorpay
  accepted a transfer we could not record. **Money may be sitting at the
  provider unrecorded.**
  1. In the Razorpay Dashboard, search Transfers by payment id
     (`commerce_orders.razorpay_payment_id`) and by the
     `spotted_order_id` note.
  2. Transfer exists → copy its id into `route_transfers.razorpay_transfer_id`,
     set status per the Dashboard state (`on_hold`/`processed`), clear
     `last_error`.
  3. No transfer exists → set status `failed` with a note; an operator may
     re-run the flow only after confirming no transfer exists.

`route_transfers.status = 'creating'` older than ~1 hour
: The process died between claim and provider call, or between provider call
  and update. Treat exactly like `needs_reconciliation` (step 1 first).

`route_transfers.status = 'failed'`
: Razorpay definitively rejected the transfer (`last_error` has the reason).
  Fix the cause (usually seller account state), then retry deliberately.

`commerce_orders.status = 'payment_conflict'`
: A signature-valid payment exists that must not finalize (amount/currency
  mismatch, listing sold to someone else first, or capture after expiry).
  1. Verify the payment in the Dashboard.
  2. Refund the captured amount to the buyer (Dashboard refund).
  3. Set the order to `refunded` and record the refund id in a note.

`route_transfers.status = 'seller_not_ready'`
: Money is with the platform, seller has no activated Linked Account. After
  the seller activates, an operator promotes the row (status `creating`) and
  re-runs the transfer flow, or refunds/settles per policy.

## Edge Function secrets (Supabase function config — never `VITE_*`)

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_ORIGINS                 # comma-separated exact origin allow-list
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_PAYMENTS_ENABLED   # exactly "true" only after all gates pass
```

## Tests

`npm test` (Node's built-in runner, no extra dependencies):

- `tests/payment_checks.test.ts` — amount/currency verification and transfer
  status mapping used by both verify paths.
- `tests/crypto.test.ts` — HMAC vectors + constant-time compare.
- `tests/shipping_quote_parity.test.ts` — client and Edge Function quote
  tables stay byte-identical.
- `tests/checkout_math.test.ts` — fee/total math, client/server parity.

## Activation gates (all required before any real money)

- Hosted Supabase project; `schema.sql` + `commerce_schema.sql` applied; RLS
  verified.
- Keep `VITE_PAYMENT_MODE=mock` and `RAZORPAY_PAYMENTS_ENABLED=false` until
  every remaining gate is complete; enable both deliberately for sandbox only.
- Razorpay merchant onboarding/KYC; test-mode keys set as function secrets.
- Razorpay Route activation; seller Linked Account KYC; test transfers with
  settlement hold verified in test mode.
- Test-mode webhook pointed at `razorpay-webhook` with its secret configured.
- Refund/dispute/returns policy and payout-release timing approved.
- Reconciliation runbook rehearsed (this file).
- End-to-end sandbox run: create order → test payment → webhook finalize →
  held transfer visible in Dashboard → conflict and mismatch drills.
