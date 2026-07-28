# Supabase backend (auth + persistence)

Feature-flagged, parallel backend for SPOTTED. With no env vars set, none of
this code runs — the app is byte-for-byte the same localStorage demo it was
before this module existed.

## What's built

- `supabaseClient.ts` — reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
  exposes `isBackendEnabled()` and a lazily-constructed `supabase` client.
  Never throws or makes a network call at import time.
- `supabaseStore.ts` — Supabase implementation of every data function
  `src/data/store.ts` exports (except `subscribe`, which is a browser event
  bus and has nothing to do with the backend). Same function names and
  parameter shapes as `store.ts`; every function is `async` because it talks
  to the network.
- `../../../supabase/schema.sql` — Postgres schema: `sellers`, `profiles`
  (1:1 with `auth.users`), `listings`, `likes`, `threads`, `messages`,
  `orders`. RLS enabled on every table, with explicit public-read /
  owner-write policies. Includes a seed section with all 12 sellers and 24
  listings from `src/data/seed.ts`.

## Store functions covered

`getFeed`, `getListing`, `isLiked`, `toggleLike`, `createListing`,
`getSeller`, `getSellerListings`, `getThreads`, `getThread`,
`getOrCreateThreadForListing`, `sendMessage`, `placeOrder`, `getOrder`,
`getUser`, `registerUser`, `loginWithPassword`, `updateMyProfile`, `logout`.

Not covered: `subscribe()` — it's the local `spotted:update` event bus, not a
persistence operation; it's unaffected by which backend is active.

## Wiring choice: parallel module, not delegation inside store.ts

`store.ts` is untouched. `supabaseStore.ts` is a separate module the app does
not import yet.

Why: most of `store.ts`'s exports are synchronous and called synchronously in
render paths — e.g. `getUser()` is called inside a `useState` initializer in
`App.tsx`, `CreateListing.tsx`, and `SellerProfile.tsx`. A Supabase call is
inherently async (network I/O), so there is no way to make `getUser()` return
real Supabase data without either (a) making it `async` and rewriting every
call site to handle a pending state, or (b) a synchronous cache that's
populated by a separate async effect — both are behavior/UX changes to
existing screens, which is out of scope here ("Do NOT redesign the store's
public API"). Only two exports (`registerUser`, `loginWithPassword`) are
already `Promise`-based, but branching just those two inside `store.ts` would
leave `getUser()` (still localStorage-only) blind to a Supabase session
immediately after a Supabase-backed login/register — a broken, half-migrated
state that is worse than not wiring it at all.

So: `store.ts`'s localStorage behavior is preserved exactly (this satisfies
"the app with NO env vars set must behave exactly as it does today", and also
happens to be true when env vars *are* set, since nothing reads them here).
`supabaseStore.ts` is a complete, ready-to-use adapter that a future
integration pass can wire in screen-by-screen (converting the relevant
`useState`/`useEffect` call sites to async), once real Supabase credentials
and testing are available.

## Activating it

1. Create a free project at supabase.com.
2. In the Supabase SQL Editor, paste and run `supabase/schema.sql` (or
   `supabase db push` with the CLI).
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from Project Settings > API.
4. Wire the screens you want backed by Supabase to call the functions in
   `supabaseStore.ts` when `isBackendEnabled()` is true (guard with
   `import { isBackendEnabled } from './backend/supabaseClient'`).

Phone-number login (`loginWithPassword` with a non-email identifier) calls
`supabase.auth.signInWithPassword({ phone, password })`, which requires an
SMS provider configured in the Supabase project and an account that verified
that phone number with Supabase Auth. `registerUser` here signs up with
email + password (phone is stored on `profiles` for display only), so the
phone-login branch needs that Supabase-side configuration to actually work —
it isn't exercised by any test in this repo.

## NOT YET

Razorpay payments and Shiprocket shipping are **not** part of this change.
The checkout/shipping features they would attach to don't exist in this app
yet, and there are no merchant/Shiprocket accounts to integrate against.
`placeOrder` in `supabaseStore.ts` mirrors the existing demo checkout (mark
listing sold, insert an order row) — nothing more.
