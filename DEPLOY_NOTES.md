# Deploy notes — SPOTTED

Custom domain: **www.spottedin.co** (owner-purchased). App is configured to serve from
the domain root (`vite base: '/'`) with a `public/CNAME` = `www.spottedin.co`.

Not deployed yet — local repo only, pending explicit go-ahead to create + push the
public GitHub repo.

## Go-live checklist

1. **Create + push the repo** (needs owner OK): `Palle017/spotted` (public), push `main`.
   GitHub Pages builds via `.github/workflows/deploy.yml`.
2. **Enable Pages custom domain**: in repo Settings → Pages, set custom domain to
   `www.spottedin.co` (the committed `CNAME` file also sets this on deploy). Enable
   "Enforce HTTPS" once the cert provisions.
3. **DNS at the registrar for spottedin.co** (owner action):
   - `www  CNAME  palle017.github.io.`  (TTL 300)
   - For the apex `spottedin.co` → redirect to `www`, add GitHub Pages A records:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (or an ALIAS/ANAME to `palle017.github.io` if the registrar supports it).
4. Propagation + cert issuance can take 15 min–24 h. Verify `https://www.spottedin.co`
   returns the app.

## OpenClaw / TardBot sidebar

Hidden from normal visitors. Open with `?claw=spotted-claw-9481` (persists in that
browser). Opens RBOT in a new tab per `src/claw/ClawPanel.tsx`; gateway auth still applies.

## Phase 2 (not started)

Supabase backend (scaffold present in `src/data/backend/` + `supabase/schema.sql`,
feature-flagged off), Razorpay payments, Shiprocket shipping — each needs owner-provided
accounts/keys and the corresponding frontend features built first.
