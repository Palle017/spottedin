# Spotted (spottedin-c)

Depop-style resale marketplace UI for India — mobile-first web app, dark visual system,
₹ pricing, mock data. Built to match the reference screen set in [CONTRACT.md](CONTRACT.md),
which is the source of truth for every screen, token, and copy string.

## Stack

Vite 5 · React 18 · TypeScript · react-router-dom (HashRouter) · lucide-react ·
hand-rolled CSS with design tokens in `src/styles/global.css`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (base './', GitHub Pages ready)
```

## Screens

| Route | Screen |
|---|---|
| `/` | Home feed (search, promo strip, greeting, 2-col listing grid) |
| `/discover` | Discover (hero carousel, outfits module, categories) |
| `/sell` | Sell splash (no-fees onboarding, no nav) |
| `/inbox` | Inbox (filter chips, empty state) |
| `/profile` | Profile (tabs, stats, earnings, promo card, empty listings) |
| `/onboarding/sizes` | First-visit sizes picker (light theme) |
| `/onboarding/brands` | Brand picker → feed (light theme) |

First visit redirects to onboarding; `localStorage.spotted_onboarded` gates it.
Listings are mock data (`src/data/mock.ts`) with picsum placeholder photos — swap for
Supabase-backed data when the backend goes live.
