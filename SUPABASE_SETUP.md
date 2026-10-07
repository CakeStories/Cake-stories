# Supabase setup

The storefront reads its catalogue (products, variants, images) from Supabase
rather than from hardcoded files. Three categories are fully database-driven:

- **Wedding Cakes** — category ID `c0c23f7c-c460-41f1-844e-b78a918f2059`
- **Birthday Cakes** — category ID `a9109392-32e1-4b67-ba87-036a7bbeaf52`
- **Kids Cakes** — category ID `8667695f-8522-4c09-9ccc-5c32d9f622b2`

## Environment variables

Create a local `.env` from `.env.example`.

**Browser-safe (VITE_ prefixed)** — these end up in the client bundle:

```env
VITE_SUPABASE_URL=https://nyigmtugjsktzkietgbc.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

**Server-only** — used by checkout and the admin dashboard. Never prefix these
with `VITE_`, or the secret ships to every visitor:

```env
SUPABASE_URL=https://nyigmtugjsktzkietgbc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET
ADMIN_PASSWORD=choose_a_strong_password
ADMIN_SESSION_SECRET=generate_a_long_random_string
ADMIN_URL_TOKEN=generate_a_long_random_string
```

## Migrations

SQL migrations live in `supabase/migrations/`. Apply them in order:

1. `20260926000000_checkout_hardening.sql` — coupon usage limits, the
   `use_coupon()` function, a unique index on `orders.razorpay_order_id`, the
   `newsletter_subscribers` table, and removal of duplicate read policies.
   Purely additive; **apply before deploying** the server-side checkout code,
   which relies on it.
2. `20260926000100_server_only_order_writes.sql` — removes customers' ability to
   insert `orders`/`order_items` directly. **Apply after deploying** the new
   checkout code (applying it earlier breaks order saving on the old code).

## Tables

The storefront needs public `SELECT` access (RLS policies) on `categories`,
`products`, `product_variants`, `product_images`, `product_category_links`,
`banners`, `addons` and `store_settings`.

| Table | Purpose |
| --- | --- |
| `categories` | Top-level categories, keyed by `slug`. |
| `products` | One row per cake. `slug` is unique and is the URL segment. |
| `product_variants` | Size/flavour rows carrying `price` and optional `mrp`. |
| `product_images` | Gallery images; the first row wins on listing pages. |
| `orders`, `order_items` | Written only by the server at checkout (see below). Customers can read their own. |
| `coupons` | Promo codes. No public access — checked server-side only. `discount_type` is `percent` or `amount` (₹ off). |
| `newsletter_subscribers` | Footer sign-ups. No public access. |

## How checkout works

All money logic is on the server, in `src/lib/checkout.server.ts`:

1. The browser sends only *what* is in the cart — product/variant/add-on
   references and quantities — never prices.
2. The server prices every line from the database (plus any running sitewide
   sale), checks the coupon, adds the delivery fee, saves the order as
   `pending`, and creates a Razorpay order for exactly that total.
3. When Razorpay reports success, the server verifies the payment signature and
   marks the order `paid` / `confirmed`.

Every order — signed-in or guest — is saved before payment, so the shop always
has the items, cake messages and delivery details. If a customer closes the
tab after paying, the order stays "Awaiting payment"; the admin **Orders** tab
has a "Check payment" button that asks Razorpay and confirms it.

## Birthday Cakes data

54 products and 132 size/price variants were imported from the printed
2026/2027 menu (migration `seed_birthday_cakes_catalogue`). Slugs follow the
menu's own product codes where they exist (`ct001`, `rv002`, `bb03`, …) and
fall back to a name slug otherwise (`opera-cake`, `nutella-cheesecake`, …).

Sizes are stored as `0.5 kg`, `1 kg`, `1.5 kg`, or `Regular` for cheesecakes.

## Storage

Images live in the public `product-images` bucket. Birthday cake photos are
under the `birthday/` prefix, named after the product slug. They are stored as
WebP at 1200x1200 (~135 KB each) — the original PNGs from the menu were ~2.3 MB
each, which would have made every listing page painfully slow:

```
product-images/birthday/ct001.webp
product-images/birthday/nutty-bubble-cake.webp
```

To upload the initial set of photos:

```sh
SUPABASE_URL=https://nyigmtugjsktzkietgbc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/upload-birthday-images.mjs ./birthday-images-web
```

After that, photos are replaced through the admin dashboard, which uploads to a
timestamped path so the new image appears immediately rather than being served
from cache. Uploads must be JPG, PNG, WebP, GIF or AVIF and under 5 MB.

## Admin dashboard

The dashboard is at `/manage/<ADMIN_URL_TOKEN>` — any other token is a plain
404. Sign in with `ADMIN_PASSWORD`; the sign-in only works from that URL, and
five wrong passwords lock that address out for 15 minutes. From there the shop
owner can:

- see and progress orders (paid, and ones awaiting payment)
- edit product names, descriptions and badges; change prices; add or remove sizes
- replace product photos, manage banners, extras, categories
- create and edit coupons (limits, minimum order, usage limit, last valid day)
- run a sitewide sale and edit the announcement bar

All of these run as server functions in `src/lib/admin.server.ts`. The page is
marked `noindex` and holds a signed, 8-hour session token in `sessionStorage`.
