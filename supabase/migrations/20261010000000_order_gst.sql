-- GST is added on top of listed prices at checkout (5% cakes, 18% Party
-- Essentials and add-ons) — see src/lib/pricing.ts. Record it on each order
-- and each line so invoices and the admin dashboard can show the breakdown.
-- APPLY BEFORE deploying the checkout code that writes these columns.
alter table public.orders
  add column if not exists gst_amount numeric(10, 2) not null default 0;

alter table public.order_items
  add column if not exists gst_rate numeric(5, 2);
