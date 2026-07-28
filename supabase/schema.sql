-- SPOTTED Supabase schema (auth + persistence).
--
-- How to apply:
--   supabase db push               (via the Supabase CLI, project linked)
--   -- or --
--   Paste this whole file into the Supabase Dashboard > SQL Editor > Run.
--
-- Mirrors src/data/types.ts and src/data/store.ts. Two seller-identity
-- tables, matching the app's own lookup order in getSeller():
--   sellers  — seed/demo marketplace sellers (src/data/seed.ts), not backed
--              by real auth accounts.
--   profiles — 1:1 companion to auth.users for real registered sellers.
-- listings.seller_id is a plain text column (no FK) because it can resolve
-- against either table, same as the app-level union lookup does.
--
-- Interpretation notes (fields with no equivalent in src/data/types.ts, added
-- only so RLS has an owner to check against):
--   threads.owner_id   — the "me" side of a thread; Thread has no such field
--                         in the TS type because the local demo assumes a
--                         single browser user. The adapter never returns this
--                         column to callers.
--   messages.sender_id — resolves Msg.from ('me'/'peer') relative to
--                         auth.uid() at read time instead of storing it.
--   orders.buyer_id    — the account that placed the order; Order has no
--                         such field in the TS type for the same reason.

-- ---------------------------------------------------------------------------
-- sellers (seed/demo — public, no auth account)
-- ---------------------------------------------------------------------------
create table if not exists sellers (
  id text primary key,
  handle text not null unique,
  name text not null,
  avatar_emoji text not null,
  bio text not null default '',
  city text not null default '',
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  sales integer not null default 0,
  created_at timestamptz not null default now()
);

alter table sellers enable row level security;

create policy "sellers are publicly readable"
  on sellers for select
  using (true);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users — real registered sellers)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  name text not null,
  avatar_emoji text not null default '🙂',
  bio text not null default '',
  city text not null default '',
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  sales integer not null default 0,
  phone text unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are publicly readable"
  on profiles for select
  using (true);

create policy "users insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users delete their own profile"
  on profiles for delete
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table if not exists listings (
  id text primary key,
  seller_id text not null,
  title text not null,
  description text not null default '',
  price_inr integer not null check (price_inr >= 0),
  category text not null check (category in ('women', 'men', 'sneakers', 'electronics', 'home', 'vintage')),
  size text,
  condition text not null check (condition in ('new', 'like-new', 'good', 'fair')),
  image_kind text not null default 'gradient' check (image_kind = 'gradient'),
  gradient_from text not null,
  gradient_to text not null,
  emoji text not null,
  photo_data_url text,
  likes integer not null default 0,
  status text not null default 'live' check (status in ('live', 'sold')),
  created_at timestamptz not null default now()
);

create index if not exists listings_seller_id_idx on listings (seller_id);
create index if not exists listings_category_idx on listings (category);

alter table listings enable row level security;

create policy "listings are publicly readable"
  on listings for select
  using (true);

create policy "users insert their own listings"
  on listings for insert
  with check (auth.uid()::text = seller_id);

create policy "users update their own listings"
  on listings for update
  using (auth.uid()::text = seller_id)
  with check (auth.uid()::text = seller_id);

create policy "users delete their own listings"
  on listings for delete
  using (auth.uid()::text = seller_id);

-- ---------------------------------------------------------------------------
-- likes (user_id + listing_id)
-- ---------------------------------------------------------------------------
create table if not exists likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id text not null references listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table likes enable row level security;

create policy "users read their own likes"
  on likes for select
  using (auth.uid() = user_id);

create policy "users insert their own likes"
  on likes for insert
  with check (auth.uid() = user_id);

create policy "users delete their own likes"
  on likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- threads
-- ---------------------------------------------------------------------------
create table if not exists threads (
  id text primary key,
  listing_id text not null references listings (id) on delete cascade,
  peer_id text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists threads_owner_id_idx on threads (owner_id);
create index if not exists threads_listing_id_idx on threads (listing_id);

alter table threads enable row level security;

create policy "users read their own threads"
  on threads for select
  using (auth.uid() = owner_id);

create policy "users insert their own threads"
  on threads for insert
  with check (auth.uid() = owner_id);

create policy "users update their own threads"
  on threads for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "users delete their own threads"
  on threads for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- messages (child rows of threads; Thread.messages in the TS type)
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id bigint generated by default as identity primary key,
  thread_id text not null references threads (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_id_idx on messages (thread_id);

alter table messages enable row level security;

create policy "users read messages in their own threads"
  on messages for select
  using (exists (
    select 1 from threads
    where threads.id = messages.thread_id
      and threads.owner_id = auth.uid()
  ));

create policy "users insert messages in their own threads"
  on messages for insert
  with check (exists (
    select 1 from threads
    where threads.id = messages.thread_id
      and threads.owner_id = auth.uid()
  ));

create policy "users delete messages in their own threads"
  on messages for delete
  using (exists (
    select 1 from threads
    where threads.id = messages.thread_id
      and threads.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id text primary key,
  listing_id text not null references listings (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  pay_method text not null check (pay_method in ('upi', 'card', 'cod')),
  status text not null default 'placed' check (status = 'placed'),
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_id_idx on orders (buyer_id);

alter table orders enable row level security;

create policy "users read their own orders"
  on orders for select
  using (auth.uid() = buyer_id);

create policy "users insert their own orders"
  on orders for insert
  with check (auth.uid() = buyer_id);

create policy "users update their own orders"
  on orders for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

-- ---------------------------------------------------------------------------
-- seed (src/data/seed.ts — 12 sellers, 24 listings)
-- ---------------------------------------------------------------------------

insert into sellers (id, handle, name, avatar_emoji, bio, city, rating, sales) values
  ('s1', '@meera.threads', 'Meera Iyer', '👩🏽', 'Curating pre-loved ethnic wear from Chennai', 'Chennai', 4.8, 132),
  ('s2', '@rohan.kicks', 'Rohan Verma', '🧑🏻', 'Sneakerhead flipping grails since 2019', 'Delhi', 4.6, 89),
  ('s3', '@priya.vintage', 'Priya Nair', '👩🏻', 'Vintage cameras & retro finds', 'Bengaluru', 4.9, 54),
  ('s4', '@arjun.tech', 'Arjun Mehta', '🧑🏽', 'Gadgets, gaming gear, good deals', 'Pune', 4.5, 210),
  ('s5', '@ananya.closet', 'Ananya Rao', '👩🏾', 'Decluttering my closet, one drop at a time', 'Hyderabad', 4.7, 76),
  ('s6', '@vikram.sports', 'Vikram Singh', '🧑🏻', 'Cricket gear & sportswear reseller', 'Mumbai', 4.4, 63),
  ('s7', '@sana.home', 'Sana Sheikh', '👩🏽', 'Home decor treasures, Jaipur sourced', 'Jaipur', 4.8, 45),
  ('s8', '@dev.streetwear', 'Dev Kapoor', '🧑🏾', 'Denim, jackets, streetwear staples', 'Delhi', 4.3, 98),
  ('s9', '@kavya.ethnic', 'Kavya Reddy', '👩🏻', 'Handpicked ethnic wear, sustainably resold', 'Hyderabad', 4.9, 121),
  ('s10', '@imran.gear', 'Imran Sheikh', '🧑🏻', 'Sneakers & gaming gear collector', 'Bengaluru', 4.6, 87),
  ('s11', '@leela.antiques', 'Leela Menon', '👵🏽', 'Family antiques finding new homes', 'Kochi', 5.0, 31),
  ('s12', '@siddharth.kurta', 'Siddharth Rao', '🧑🏽', 'Men''s ethnic wear specialist', 'Lucknow', 4.5, 68)
on conflict (id) do nothing;

insert into listings (id, seller_id, title, description, price_inr, category, size, condition, gradient_from, gradient_to, emoji, likes, status) values
  ('l1', 's1', 'Banarasi Silk Saree', 'Handwoven Banarasi silk saree with gold zari border. Worn once for a wedding, dry-cleaned and stored with care.', 4999, 'women', 'Free', 'like-new', '#D6336C', '#F7C948', '🥻', 34, 'live'),
  ('l2', 's6', 'Team India Cricket Jersey', 'Official replica ODI jersey, 2023 edition. Worn a handful of times, no fading.', 1299, 'men', 'L', 'good', '#1D4ED8', '#F97316', '🏏', 21, 'live'),
  ('l3', 's2', 'Air Jordan 1 Retro High', 'Chicago colourway, authentic with box and extra laces. Light creasing on toe box.', 8999, 'sneakers', 'UK9', 'like-new', '#B91C1C', '#111827', '👟', 58, 'sold'),
  ('l4', 's9', 'Bridal Lehenga Set', 'Heavy embroidered bridal lehenga with dupatta and matching blouse. One function only.', 15999, 'women', 'M', 'good', '#EC4899', '#5E657B', '👗', 47, 'live'),
  ('l5', 's3', 'Vintage Yashica Film Camera', '1970s Yashica 35mm rangefinder, fully functional, light meter works. A collector''s piece.', 3499, 'vintage', null, 'fair', '#92400E', '#FDE68A', '📷', 29, 'live'),
  ('l6', 's12', 'Men''s Kurta Set', 'Cotton kurta-pyjama set, unstitched tags still on. Festive occasion wear.', 899, 'men', 'L', 'new', '#0F766E', '#FACC15', '👘', 12, 'live'),
  ('l7', 's4', 'Sony PS5 DualSense Controller', 'Barely used, no stick drift, comes with original box and cable.', 3999, 'electronics', null, 'like-new', '#4338CA', '#0F172A', '🎮', 41, 'live'),
  ('l8', 's7', 'Brass Diya Set (Set of 6)', 'Handcrafted brass diyas, intricate engraving, perfect for Diwali. Unused, in original packaging.', 599, 'home', null, 'new', '#B45309', '#7F1D1D', '🪔', 18, 'live'),
  ('l9', 's8', 'Levi''s Denim Jacket', 'Classic trucker jacket, medium wash, broken in perfectly. No rips or stains.', 1799, 'men', 'M', 'good', '#1E3A8A', '#93C5FD', '🧥', 33, 'live'),
  ('l10', 's4', 'Akko Mechanical Keyboard', 'Hot-swappable mechanical keyboard with tactile browns, RGB backlight, barely used.', 4499, 'electronics', null, 'like-new', '#6D28D9', '#111827', '⌨️', 26, 'live'),
  ('l11', 's1', 'Chanderi Silk Dupatta', 'Lightweight Chanderi silk dupatta with gold border, unused with tags.', 799, 'women', null, 'new', '#0D9488', '#FDE047', '🧣', 15, 'live'),
  ('l12', 's10', 'Nike Air Max Sneakers', 'Air Max 90, worn a few times, minor sole wear, otherwise clean.', 5499, 'sneakers', 'UK8', 'good', '#16A34A', '#F0FDF4', '👟', 22, 'live'),
  ('l13', 's7', 'Rajasthani Puppet Wall Decor', 'Handpainted Kathputli wall hanging, vibrant colours, great statement piece.', 449, 'home', null, 'good', '#C2410C', '#FDE68A', '🖼️', 9, 'live'),
  ('l14', 's5', 'Women''s Palazzo Set', 'Printed palazzo co-ord set, breathable rayon fabric, worn twice.', 1099, 'women', 'S', 'new', '#F97316', '#FFF7ED', '👚', 17, 'live'),
  ('l15', 's11', 'Vintage Vinyl Record Player', 'Fully working turntable from the 1980s, belonged to my father, well maintained.', 6999, 'vintage', null, 'fair', '#7C2D12', '#FBBF24', '💿', 24, 'live'),
  ('l16', 's12', 'Men''s Nehru Jacket', 'Maroon Nehru jacket, festive wear, dry-cleaned, worn once.', 1499, 'men', 'L', 'like-new', '#7F1D1D', '#FACC15', '🧥', 14, 'live'),
  ('l17', 's3', 'Canon DSLR Camera + Bag Combo', 'Canon 1500D with 18-55mm kit lens, camera bag and 32GB card included.', 12999, 'electronics', null, 'good', '#111827', '#6B7280', '📸', 37, 'live'),
  ('l18', 's7', 'Handwoven Jute Rug', 'Natural jute area rug, 5x7 ft, handwoven, great for living rooms.', 1299, 'home', null, 'new', '#A16207', '#FEF3C7', '🪢', 11, 'live'),
  ('l19', 's2', 'Adidas Ultraboost Sneakers', 'Ultraboost 21, worn a handful of runs, boost cushioning still springy.', 6499, 'sneakers', 'UK10', 'like-new', '#F8FAFC', '#111827', '👟', 44, 'sold'),
  ('l20', 's3', 'Vintage Polaroid Camera', 'Working Polaroid 600 series camera, tested with fresh film pack.', 2999, 'vintage', null, 'good', '#EA580C', '#78350F', '🎞️', 19, 'live'),
  ('l21', 's9', 'Ethnic Anarkali Suit', 'Floor-length Anarkali suit with dupatta, worn once at a family function.', 2499, 'women', 'M', 'like-new', '#BE185D', '#FACC15', '👗', 31, 'live'),
  ('l22', 's10', 'Logitech Gaming Mouse', 'Logitech G302, unused, still sealed, extra weight kit included.', 1999, 'electronics', null, 'new', '#111827', '#22C55E', '🖱️', 16, 'live'),
  ('l23', 's11', 'Antique Brass Wall Clock', 'Vintage brass wall clock, working condition, beautiful patina.', 1899, 'vintage', null, 'fair', '#92400E', '#FEF3C7', '🕰️', 13, 'live'),
  ('l24', 's12', 'Ethnic Nehru Kurta', 'Navy blue Nehru-collar kurta, festive fabric, brand new with tags.', 1199, 'men', 'XL', 'new', '#1E293B', '#EAB308', '🥻', 8, 'live')
on conflict (id) do nothing;
