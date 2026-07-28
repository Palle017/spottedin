# Deploy notes — SPOTTED

Not deployed yet — this is a local fork of maanster-market, forked and rebranded to
SPOTTED. Deploy target is `Palle017/spotted` (GitHub Pages via Actions), pending explicit
go-ahead before the repo is created and pushed.

Site is not password-gated (no gate component exists in this codebase).

## OpenClaw / TardBot sidebar

Hidden from normal visitors. Open it with:
`https://palle017.github.io/spotted/?claw=spotted-claw-9481`
(then it stays enabled in that browser). It opens RBOT in a new tab per
`src/claw/ClawPanel.tsx` — full OpenClaw Control UI, gateway auth still applies.

## Phase 2 (not started)

Supabase backend (store.ts is shaped to swap in the Supabase client), Razorpay real
integration, Shiprocket, then the Expo iOS app per Downloads/resalemarketplaceiosplan.md.
