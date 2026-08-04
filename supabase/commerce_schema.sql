-- SPOTTED Razorpay + Route commerce schema. Apply AFTER schema.sql
-- (same ways: `supabase db push` or paste into the SQL Editor).
--
-- Conventions follow schema.sql: listings.id and listings.seller_id are text
-- (seed sellers like 's1' or auth uuids as text); buyers are always real
-- auth.users. Payout accounts exist only for registered sellers (profiles),
-- so route_transfers.seller_id stays text while seller_payout_accounts is
-- keyed by the profile uuid.
--
-- Money states are fail-closed:
--   commerce_orders.payment_conflict  — a signature-valid payment arrived that
--       cannot safely finalize (amount mismatch, listing already sold, order
--       already expired). Manual runbook only (RAZORPAY_ROUTE.md).
--   route_transfers.needs_reconciliation — the provider MAY hold a transfer we
--       could not record (or the outcome is unknown). Never auto-retried.

create or replace function set_commerce_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- commerce_orders — one row per checkout attempt; server-computed amounts
-- ---------------------------------------------------------------------------
create table if not exists commerce_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references listings (id),
  buyer_id uuid not null references auth.users (id),
  seller_id text not null,
  item_price_inr integer not null,
  platform_fee_inr integer not null default 0,
  shipping_fee_inr integer not null default 0,
  total_inr integer not null,
  currency text not null default 'INR',
  status text not null default 'payment_pending',
  shipping_address jsonb not null,
  courier_id text,
  courier_name text,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_orders_distinct_parties check (buyer_id::text <> seller_id),
  constraint commerce_orders_amounts check (
    item_price_inr > 0 and platform_fee_inr >= 0 and shipping_fee_inr >= 0
  ),
  constraint commerce_orders_total_matches check (
    total_inr = item_price_inr + platform_fee_inr + shipping_fee_inr
  ),
  constraint commerce_orders_currency check (currency = 'INR'),
  constraint commerce_orders_status check (
    status in (
      'payment_pending',
      'payment_authorized',
      'paid',
      'payment_failed',
      'expired',
      'cancelled',
      'payment_conflict',
      'refunded'
    )
  ),
  constraint commerce_orders_shipping_address_object check (
    jsonb_typeof(shipping_address) = 'object'
  )
);

create unique index if not exists commerce_orders_one_active_checkout_per_listing
  on commerce_orders (listing_id)
  where status in ('payment_pending', 'payment_authorized', 'paid');

create index if not exists commerce_orders_buyer_created_at_idx
  on commerce_orders (buyer_id, created_at desc);

alter table commerce_orders enable row level security;
revoke all on table commerce_orders from anon, authenticated;
grant select on table commerce_orders to authenticated;

create policy "buyers and sellers read their orders"
  on commerce_orders for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()::text
  );

create trigger commerce_orders_set_updated_at
before update on commerce_orders
for each row execute function set_commerce_updated_at();

-- ---------------------------------------------------------------------------
-- provider_events — webhook dedupe ledger (service role only)
-- ---------------------------------------------------------------------------
create table if not exists provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  constraint provider_events_provider check (provider in ('razorpay')),
  constraint provider_events_unique unique (provider, event_id)
);

alter table provider_events enable row level security;
revoke all on table provider_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- seller_payout_accounts — Route Linked Account readiness per registered
-- seller. Rows are created/updated by operators (Dashboard onboarding), never
-- from the browser; sellers can only read their own readiness.
-- ---------------------------------------------------------------------------
create table if not exists seller_payout_accounts (
  user_id uuid primary key references profiles (id) on delete cascade,
  provider text not null default 'razorpay_route',
  razorpay_account_id text unique,
  status text not null default 'not_started',
  transfers_enabled boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payout_accounts_provider check (provider = 'razorpay_route'),
  constraint seller_payout_accounts_status check (
    status in ('not_started', 'account_created', 'kyc_pending', 'activated', 'suspended', 'rejected')
  ),
  constraint seller_payout_accounts_provider_id check (
    razorpay_account_id is null
    or razorpay_account_id ~ '^acc_[A-Za-z0-9]{8,32}$'
  ),
  constraint seller_payout_accounts_enabled_status check (
    not transfers_enabled or status = 'activated'
  )
);

alter table seller_payout_accounts enable row level security;
revoke all on table seller_payout_accounts from anon, authenticated;
grant select on table seller_payout_accounts to authenticated;

create policy "sellers read their payout readiness"
  on seller_payout_accounts for select
  to authenticated
  using (user_id = auth.uid());

create trigger seller_payout_accounts_set_updated_at
before update on seller_payout_accounts
for each row execute function set_commerce_updated_at();

-- ---------------------------------------------------------------------------
-- route_transfers — one held transfer per paid order (item price only)
-- ---------------------------------------------------------------------------
create table if not exists route_transfers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references commerce_orders (id) on delete cascade,
  seller_id text not null,
  provider text not null default 'razorpay_route',
  linked_account_id text,
  razorpay_transfer_id text unique,
  amount_inr integer not null,
  currency text not null default 'INR',
  status text not null default 'seller_not_ready',
  settlement_status text,
  on_hold boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_transfers_provider check (provider = 'razorpay_route'),
  constraint route_transfers_amount check (amount_inr > 0),
  constraint route_transfers_currency check (currency = 'INR'),
  constraint route_transfers_status check (
    status in (
      'seller_not_ready',
      'creating',
      'on_hold',
      'ready_to_release',
      'processed',
      'failed',
      'needs_reconciliation',
      'reversed',
      'partially_reversed'
    )
  ),
  constraint route_transfers_settlement_status check (
    settlement_status is null
    or settlement_status in ('pending', 'on_hold', 'settled')
  )
);

create index if not exists route_transfers_seller_created_at_idx
  on route_transfers (seller_id, created_at desc);

alter table route_transfers enable row level security;
revoke all on table route_transfers from anon, authenticated;
grant select on table route_transfers to authenticated;

create policy "sellers read their route transfers"
  on route_transfers for select
  to authenticated
  using (seller_id = auth.uid()::text);

create trigger route_transfers_set_updated_at
before update on route_transfers
for each row execute function set_commerce_updated_at();

-- ---------------------------------------------------------------------------
-- finalize_paid_commerce_order — the ONLY way an order becomes paid.
-- Row-locked; atomically flips the listing live->sold. Explicit status guard:
-- an order that already expired or was cancelled can NOT be finalized by a
-- late capture — it parks as payment_conflict for the refund runbook.
-- ---------------------------------------------------------------------------
create or replace function finalize_paid_commerce_order(
  target_order_id uuid,
  target_payment_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target commerce_orders;
begin
  select * into target
  from commerce_orders
  where id = target_order_id
  for update;

  if target.id is null then
    raise exception 'Commerce order not found' using errcode = '22023';
  end if;

  if target.status = 'paid' then
    return 'paid';
  end if;

  if target.expires_at <= now() then
    update commerce_orders
    set status = 'payment_conflict',
        razorpay_payment_id = coalesce(razorpay_payment_id, target_payment_id)
    where id = target_order_id;
    return 'payment_conflict';
  end if;

  if target.status not in ('payment_pending', 'payment_authorized') then
    update commerce_orders
    set status = 'payment_conflict',
        razorpay_payment_id = coalesce(razorpay_payment_id, target_payment_id)
    where id = target_order_id;
    return 'payment_conflict';
  end if;

  update listings
  set status = 'sold'
  where id = target.listing_id
    and status = 'live';

  if found then
    update commerce_orders
    set status = 'paid',
        razorpay_payment_id = target_payment_id,
        paid_at = now()
    where id = target_order_id;
    return 'paid';
  end if;

  update commerce_orders
  set status = 'payment_conflict',
      razorpay_payment_id = target_payment_id
  where id = target_order_id;
  return 'payment_conflict';
end;
$$;

revoke all on function finalize_paid_commerce_order(uuid, text)
  from public, anon, authenticated;
grant execute on function finalize_paid_commerce_order(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- claim_route_transfer — idempotency lock for held-transfer creation.
-- Exactly one caller acquires the claim for a paid order; everyone else sees
-- acquired=false. Sellers without an activated payout account get a
-- seller_not_ready row that an operator can later promote.
-- ---------------------------------------------------------------------------
create or replace function claim_route_transfer(target_order_id uuid)
returns table (
  payout_id uuid,
  payment_id text,
  linked_account_id text,
  amount_inr integer,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order commerce_orders%rowtype;
  target_account seller_payout_accounts%rowtype;
  claimed_id uuid;
begin
  select * into target_order
  from commerce_orders
  where id = target_order_id
    and status = 'paid'
    and razorpay_payment_id is not null;

  if not found then
    return;
  end if;

  select * into target_account
  from seller_payout_accounts
  where user_id::text = target_order.seller_id
    and status = 'activated'
    and transfers_enabled
    and razorpay_account_id is not null;

  if not found then
    insert into route_transfers (order_id, seller_id, amount_inr, status, last_error)
    values (
      target_order.id,
      target_order.seller_id,
      target_order.item_price_inr,
      'seller_not_ready',
      'Seller Razorpay Route account is not activated'
    )
    on conflict (order_id) do nothing;

    return query
    select rt.id, target_order.razorpay_payment_id, rt.linked_account_id, rt.amount_inr, false
    from route_transfers rt
    where rt.order_id = target_order.id;
    return;
  end if;

  insert into route_transfers (order_id, seller_id, linked_account_id, amount_inr, status, last_error)
  values (
    target_order.id,
    target_order.seller_id,
    target_account.razorpay_account_id,
    target_order.item_price_inr,
    'creating',
    null
  )
  on conflict (order_id) do nothing
  returning id into claimed_id;

  if claimed_id is null then
    update route_transfers
    set linked_account_id = target_account.razorpay_account_id,
        status = 'creating',
        last_error = null
    where order_id = target_order.id
      and status = 'seller_not_ready'
    returning id into claimed_id;
  end if;

  return query
  select rt.id, target_order.razorpay_payment_id, target_account.razorpay_account_id, rt.amount_inr,
         coalesce(rt.id = claimed_id, false)
  from route_transfers rt
  where rt.order_id = target_order.id;
end;
$$;

revoke all on function claim_route_transfer(uuid)
  from public, anon, authenticated;
grant execute on function claim_route_transfer(uuid)
  to service_role;
