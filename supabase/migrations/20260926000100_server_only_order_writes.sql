-- APPLY ONLY AFTER the server-side checkout code is deployed.
--
-- Orders are now written exclusively by the server (service role) after it has
-- priced the cart itself. Customers keep read access to their own orders, but
-- can no longer insert rows directly — previously any signed-in user could
-- create an order marked "paid" with any total.
drop policy if exists "Users can insert their own orders" on public.orders;
drop policy if exists "Users can insert their own order items" on public.order_items;
