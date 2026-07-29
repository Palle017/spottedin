# Spotted — build contract (spottedin-c)

Spotted is a Depop-style resale marketplace for India. This repo is the mobile-first web
UI. Every screen below was specced from reference screenshots of the layout we are
matching. Match the layout and visual system exactly; all branding, copy, and imagery are
Spotted's own ("Spotted" wordmark, ₹ prices, original placeholder photos). Never use the
word "Depop", its logo, or its imagery anywhere in this repo.

## Stack & commands

- Vite 5 + React 18 + TypeScript, `react-router-dom` (HashRouter), `lucide-react` icons.
- Hand-rolled CSS (plain .css files, CSS variables). No Tailwind, no UI kits.
- Only deps allowed: `react`, `react-dom`, `react-router-dom`, `lucide-react` (+ dev:
  vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom). NO OTHERS.
- Verify with `npx tsc --noEmit` (screen agents) and `npm run build` (integrate agent).
- Vite `base: './'` so GitHub Pages works.

## App shell

- Mobile-first: content column `max-width: 430px; margin: 0 auto; min-height: 100dvh`.
  On desktop the column sits centered on a `#111` page background.
- Dark theme is the default (Home, Discover, Sell, Inbox, Profile). Onboarding screens
  are light — they set `class="light"` on their page root and use light tokens.
- Font: `Archivo` from Google Fonts (weights 400–900) loaded in `index.html`, fallback
  `system-ui, -apple-system, sans-serif`. Headlines are 700–800 weight, slightly tight
  letter-spacing (-0.02em).

## Design tokens (src/styles/global.css)

```css
:root {
  --bg: #000;              /* app background */
  --surface: #1c1c1e;      /* pills, cards, nav */
  --surface-2: #2c2c2e;    /* pressed / secondary surface */
  --text: #fff;
  --text-dim: #9c9c9c;
  --hairline: #2a2a2a;
  --accent: #ff2300;       /* Spotted red — promos, badges */
  --promo-olive: #57492f;  /* home promo strip */
  --success: #1f7a3d;      /* "New" pill */
  --radius-pill: 999px;
  --radius-card: 12px;
}
.light {
  --bg: #fff; --surface: #f2f2f2; --surface-2: #e5e5e5;
  --text: #1a1a1a; --text-dim: #6b6b6b; --hairline: #d9d9d9;
}
```

## Shared components (built by scaffold, owned by scaffold)

- `src/components/BottomNav.tsx` — floating pill nav, `position: fixed; bottom: 12px`,
  centered, width `calc(100% - 24px)` capped at 406px, bg `--surface`, radius 999px,
  subtle shadow. Five items: Home (House icon), Discover (Search), Sell (Plus),
  Inbox (Mail), My Spotted (User). Icon 24px above 11px label. Active item: white icon +
  label inside a slightly lighter rounded highlight; inactive: `--text-dim`.
  Hidden on `/sell` and `/onboarding/*` routes.
- `src/components/SearchBar.tsx` — pill input, bg `--surface`, Search icon left,
  Camera icon right, placeholder "Search for anything". Right of it a separate capsule
  (bg `--surface`, radius 999) holding Heart and ShoppingBag icon buttons. Props:
  `{ rightIcons?: React.ReactNode }` to swap the capsule contents.
- `src/components/Chip.tsx` — pill chip. Props `{ label, selected?, onClick? }`.
  Outline 1px `--hairline` default; selected = solid fill (white-on-black in dark,
  black-fill white-text in light).
- `src/components/ProductCard.tsx` — square image (rounded 8px, `object-fit: cover`,
  bg `--surface` while loading), Heart button top-right overlaid with like count in
  white 13px below the icon. Under the image, left-aligned 14px lines: brand, size,
  then bold price `₹1,499` with optional struck-through original price in `--text-dim`.
- `src/data/mock.ts` — types + data:
  ```ts
  export type Listing = { id: string; brand: string; size: string; price: number;
    originalPrice?: number; likes: number; img: string }
  export const user = { name: 'Manasa', handle: 'manasa', initials: 'MP' }
  ```
  16 listings, brands like Levi's, Nike, Zara, H&M, Carhartt, Polo Ralph Lauren, FabIndia,
  Adidas; sizes S–XL; prices ₹399–₹4,999 (a few with originalPrice + likes 5–80).
  Images: `https://picsum.photos/seed/spotted-<n>/600/600`.

## Routes (HashRouter, wired by scaffold with stub pages)

| Route | File | Theme |
|---|---|---|
| `/` | src/pages/Home.tsx | dark |
| `/discover` | src/pages/Discover.tsx | dark |
| `/sell` | src/pages/Sell.tsx | dark, no BottomNav |
| `/inbox` | src/pages/Inbox.tsx | dark |
| `/profile` | src/pages/Profile.tsx | dark |
| `/onboarding/sizes` | src/pages/onboarding/Sizes.tsx | light, no BottomNav |
| `/onboarding/brands` | src/pages/onboarding/Brands.tsx | light, no BottomNav |

First visit (no `localStorage.spotted_onboarded`): `/` redirects to `/onboarding/sizes`.
"See my feed" / both Skip buttons set the flag and go to `/`.

## Screen specs — match these exactly

### Home (`/`)
Top: SearchBar row (heart + bag capsule right). Below, a full-width promo strip, bg
`--promo-olive`, centered two lines: bold 16px "Free shipping on your first order",
13px "No minimum spend. Ends Aug 5. T&Cs apply". Then 24px bold greeting
"Hey {user.name}!", then 16px regular "Tap into a few items to unlock better picks".
Then a 2-column grid (8px gap) of ProductCards using all mock listings. Grid scrolls
under the floating nav; add bottom padding ~96px.

### Discover (`/discover`)
SearchBar row. Hero carousel: horizontally scroll-snapped full-width cards
(aspect ~3:4 capped at 55vh, image cover, bottom gradient overlay) with centered
overlay near the bottom: 28px bold title ("The Summer Edit", "Campus Fits",
"Y2K Revival"), 15px "Shop the edit" below, and 3 dots (active white, rest 40% white)
under the text. Use picsum seeds `spotted-hero-1..3`.
Below: a rounded-16px card (1px `--hairline` border, 16px padding) — header row: 22px
bold "Discover your next look" + small green pill "New"; body 15px `--text-dim`:
"Get inspired by outfits styled by the Spotted community and shop the pieces you love.";
then 3 outfit collages in a row (each: light-pink `#f6e7ef` rounded card, a 2×2 grid of
small product images from mock data, ~4px inner gaps); then full-width outline pill
button "Browse outfits".
Then 22px bold "Shop by category" and list rows Men / Women / Kids /
Everything else — 17px text, ChevronRight, 1px `--hairline` separators, ~56px tall.

### Sell (`/sell`)
Full-screen splash, no nav. Background: picsum seed `spotted-rack` covering the top
~60%, fading into black via gradient; bottom 40% solid black. Top overlay: four thin
(3px) progress bars in a row — first solid white, rest 35% white; X (close) top-right
returns to `/`. Bottom-anchored text block, left-aligned, 20px side padding:
13px bold "Selling on Spotted"; 40px/1.05 800-weight headline "Keep your cash — no
selling fees"; 14px "Standard payment processing fees still apply."; spacer; 13px
"By continuing you agree to our Terms of Service." (bold "Terms of Service");
centered 16px bold "Set up as a business"; full-width white pill button (52px tall,
black 17px bold text) "Start selling".

### Inbox (`/inbox`)
Header row: centered 22px bold "Inbox"; right capsule with SlidersHorizontal + Bell
icons. Chip row (10px gap): All / Messages / Selling / Buying — "All" selected
(white fill, black text), rest outlined. Empty state vertically centered: a 96px
rounded-22px blue (#2f7cf6) square with a white chat-bubble shape (CSS/SVG) and a red
`--accent` circular badge "0" on its top-right corner, soft ellipse shadow below;
then 17px `--text-dim` "No messages yet."

### Profile (`/profile`)
Header: centered 22px bold `{user.handle}`; right capsule with Plus + Menu icons.
Tab bar: Shop / Sold / Purchases / Likes — 17px bold, active has 3px white underline,
full-width 1px `--hairline` under the row. Body (16px padding):
Row: 88px white circle with black 24px bold `{user.initials}`, then three stat blocks —
bold 20px "0" over 15px `--text-dim` "followers", same for "following", and a Star icon
over "no reviews". Below: dark pill chip with BarChart2 icon + "Earnings".
Promo banner card (radius 12, overflow hidden, dismissible via X top-right): left 27%
is an image (picsum seed `spotted-flatlay`), right bg `--accent` with white text:
15px bold "Represent Spotted on Campus", 15px "Become a Spotted Campus Manager",
15px bold "Apply today".
Row: 22px bold "Active" + regular "(0 listings)" left; right a 40px rounded-8 outlined
button with SlidersHorizontal icon. Empty state centered: a clothes-rack line
illustration (inline SVG, ~180px: silver rack frame with legs, one wooden hanger
hanging from a small red clip at the center of the rail — draw with strokes, no image
files); 24px bold "No active listings"; 16px "List an item so buyers can discover your
shop."; white pill button "Start selling" → `/sell`.

### Onboarding — Sizes (`/onboarding/sizes`, light)
Top-right "Skip" in a soft `--surface` circle-pill. 34px 800 "Tell us your sizes";
16px "This will help you see items that are more relevant". Tabs "Women's" / "Men's"
(17px bold; active black with 3px black underline; hairline under the row; Men's
default). Scrollable sections with 20px bold headers: **Tops** — chips US 3XS, US XXS,
US XS, US S, US M, US L, US XL, US XXL, US 3XL, US 4XL, US 5XL, US 6XL in a 3-column
grid; **Bottoms** — same letter sizes, then waist chips US 26"–US 61" (every inch);
**Shoes** — US 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5,
13, 13.5, 14, 14.5, 15, 15.5, 16. Chips are ~52px tall outlined pills, multi-select,
selected = black fill/white text. Women's tab: same letter sections (skip waist
inches). Sticky bottom "Next" pill: `--surface-2` gray + dim text when nothing
selected, black/white when ≥1 chip selected → `/onboarding/brands`.

### Onboarding — Brands (`/onboarding/brands`, light)
Skip top-right. 34px 800 "What brands are you into?"; 16px "Choose brands you actually
love — we'll use them to shape your feed." Search pill (Search icon, placeholder
"Search any brand") filtering the chip cloud. Wrapped flex chip cloud (10px gaps),
~52px pills, multi-select: Adidas, Jordan, Supreme, Polo Ralph Lauren, Ralph Lauren,
Carhartt, The North Face, Nike, Levi's, Wrangler, Louis Vuitton, Burberry,
Harley Davidson, Vans, Chrome Hearts, Palm Angels, Rick Owens, Maison Margiela,
Arc'teryx, Salomon, Moncler, Canada Goose, New Era, Mitchell & Ness, Stone Island,
FabIndia, Sabyasachi, Zara, H&M, Uniqlo. Sticky bottom pill "See my feed" (gray until
≥1 selected, then black) → sets onboarded flag, navigates `/`.

## File ownership (hard rule — never edit outside your set)

| Agent | Owns |
|---|---|
| scaffold | all config, index.html, src/main.tsx, src/App.tsx, src/styles/global.css, src/components/*, src/data/mock.ts, stub pages |
| home | src/pages/Home.tsx, src/pages/home.css, src/components/ProductCard.tsx |
| discover | src/pages/Discover.tsx, src/pages/discover.css |
| sell | src/pages/Sell.tsx, src/pages/sell.css |
| inbox | src/pages/Inbox.tsx, src/pages/inbox.css |
| profile | src/pages/Profile.tsx, src/pages/profile.css |
| onboarding | src/pages/onboarding/* |
| integrate | anything, but only to fix build/type/route errors and visual-consistency bugs |

Screen agents: do not run `npm install` or `npm run build`; verify with
`npx tsc --noEmit` only. Do not modify package.json, App.tsx, global.css, or another
agent's files — if you need a shared change, note it in your report instead.
