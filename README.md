# Cake Stories

The online store for Cake Stories — cakes, party essentials and sweet treats,
with online payment, store pickup and delivery within 15 km of the shops.

## Running it locally

You need Node.js 22 or newer.

```sh
npm install
cp .env.example .env   # then fill in the real values (see below)
npm run dev            # http://localhost:8080
```

`npm run build` makes a production build. When the Vercel project is connected
to this GitHub repository, every push to `main` deploys the live site.

## Settings (environment variables)

Every value is described in `.env.example`. Set the same values in Vercel
(Project → Settings → Environment Variables). Values starting with `VITE_`
are visible to visitors' browsers; everything else must stay secret.

| Variable | What it's for |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The store's database (public, read-only key) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database access for checkout and the admin panel — secret |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID` | Online payments |
| `ADMIN_URL_TOKEN` | The secret part of the admin panel address: `/manage/<token>` |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Admin panel sign-in |
| `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `ORDER_ALERT_EMAILS` | Order emails: a confirmation to the customer and a new-order alert to the shop (Resend) |
| `GOOGLE_PLACE_ID`, `GOOGLE_PLACES_API_KEY` | Optional — shows Google reviews on the homepage |

## Managing the store

- **Admin panel** (`/manage/<ADMIN_URL_TOKEN>`): orders, products and prices,
  banners, store settings and offers, extras, coupons, newsletter sign-ups and
  categories.
- **Website editor** (the "Edit website" button in the admin panel): change
  any text, photo or link directly on the pages. Changes go live for everyone
  within about a minute.

## How it's built

- [TanStack Start](https://tanstack.com/start) (React 19, TypeScript), styled with Tailwind CSS
- [Supabase](https://supabase.com) for the database, sign-in and photo storage — see `SUPABASE_SETUP.md`
  and the database changes in `supabase/migrations/`
- Razorpay for payments
- Hosted on Vercel

Main folders: `src/routes/` (one file per page), `src/components/` (shared
page parts), `src/lib/` (data, pricing, checkout and admin logic — files ending
`.server.ts` run only on the server).
