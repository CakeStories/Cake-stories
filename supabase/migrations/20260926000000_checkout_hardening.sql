-- Additive changes for the server-side checkout. Safe to apply before the new
-- code is deployed: nothing here removes access the current site relies on.

-- Coupon usage limits. times_used is only ever incremented by the server once
-- a payment is confirmed, through use_coupon() below.
alter table public.coupons add column if not exists max_uses integer check (max_uses is null or max_uses > 0);
alter table public.coupons add column if not exists times_used integer not null default 0;

-- Atomically counts one use of a coupon, refusing once max_uses is reached.
-- Only the service role may call it.
create or replace function public.use_coupon(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.coupons
       set times_used = times_used + 1
     where code = p_code
       and (max_uses is null or times_used < max_uses)
    returning 1
  )
  select exists (select 1 from updated);
$$;
revoke all on function public.use_coupon(text) from public, anon, authenticated;
grant execute on function public.use_coupon(text) to service_role;

-- One order row per Razorpay order, so a payment can never be recorded twice.
create unique index if not exists orders_razorpay_order_id_key
  on public.orders (razorpay_order_id) where razorpay_order_id is not null;
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Newsletter sign-ups from the footer. RLS on with no policies: only the
-- server (service role) can read or write it.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

-- Duplicate public SELECT policies — each table keeps exactly one.
drop policy if exists "Allow public to read products" on public.products;
drop policy if exists "Anyone can view products" on public.products;
drop policy if exists "Anyone can view product variants" on public.product_variants;
