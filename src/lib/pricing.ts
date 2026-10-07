/**
 * Pricing rules shared by the browser (for display) and the server (which
 * decides what the customer is actually charged — see checkout.server.ts).
 * Keep every money calculation here so the two can never drift apart.
 */

export const DELIVERY_FEE = 49;
export const FREE_DELIVERY_THRESHOLD = 999;

// Delivery windows, not exact times — standard delivery hours are 9am–6pm.
export const TIME_SLOTS = ["9:00 am - 12:00 pm", "12:00 pm - 3:00 pm", "3:00 pm - 6:00 pm"];

/**
 * Same-day orders must be placed before this hour (shop/IST time). At or
 * after it, "today" is no longer offered as a delivery date at all — not
 * just its earlier slots — and the earliest date becomes tomorrow.
 */
export const SAME_DAY_CUTOFF_HOUR = 15; // 3:00 PM

/** How far ahead of a slot's start an order needs to land for the kitchen to make it in time. */
const PREP_BUFFER_HOURS = 3;

export const PICKUP_BRANCHES = ["North Street, Marthandam", "Arumanai Main Road, Anducode"];

export const CAKE_MESSAGE_MAX = 60;
export const INSTRUCTIONS_MAX = 300;

/**
 * What a cart line *is*, independent of the price it was displayed at. The
 * server re-prices every line from this reference, so a price saved in the
 * browser is never trusted.
 */
export type CartItemRef =
  | { type: "catalog"; slug: string } // hand-entered product in catalog.ts
  | { type: "variant"; variantId: string } // Supabase product_variants row
  | { type: "addon"; addonId: string }; // Supabase addons row

/** Price after the sitewide sale, if one is running. Add-ons are never discounted. */
export function applySitewideDiscount(price: number, percent: number | null | undefined): number {
  if (!percent) return price;
  return Math.round(price * (1 - percent / 100));
}

export function deliveryFeeFor(subtotal: number, fulfillment: "delivery" | "pickup"): number {
  if (fulfillment === "pickup" || subtotal === 0) return 0;
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

export type CouponType = "percent" | "amount";

export function couponDiscount(type: CouponType, value: number, subtotal: number): number {
  return type === "percent" ? Math.round((subtotal * value) / 100) : Math.min(value, subtotal);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * The current moment, as a Date whose UTC fields (getUTCHours, getUTCDate, …)
 * equal the shop's own IST wall-clock time — regardless of where the code
 * runs. Read it with the UTC getters/setters, never the local ones.
 */
function shopNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Today's date as YYYY-MM-DD in the shop's timezone (IST), regardless of where the code runs. */
export function shopTodayIso(): string {
  return shopNow().toISOString().slice(0, 10);
}

/** Any shop-time Date (see shopNow/earliestDelivery) as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// These must match WEDDING_CAKES_CATEGORY_ID in wedding-cakes.ts and
// KIDS_CAKES_CATEGORY_ID in kids-cakes.ts — duplicated here so this file
// (shared by the browser and the server) has no dependency on either.
export const WEDDING_CAKES_CATEGORY_ID = "c0c23f7c-c460-41f1-844e-b78a918f2059";
export const KIDS_CAKES_CATEGORY_ID = "8667695f-8522-4c09-9ccc-5c32d9f622b2";

/** Categories that need at least 24 hours' notice instead of same-day delivery. */
export const ADVANCE_NOTICE_CATEGORY_IDS: ReadonlySet<string> = new Set([
  WEDDING_CAKES_CATEGORY_ID,
  KIDS_CAKES_CATEGORY_ID,
]);

/**
 * Client-side check from a cart line's `href` (e.g. "/wedding-cake/wed001")
 * — used on the checkout page, which has each line's product page link but
 * not its category id.
 */
export function hrefNeedsAdvanceNotice(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith("/wedding-cake/") || href.startsWith("/kids-cake/");
}

/**
 * Earliest moment an order can be delivered, in shop time (see shopNow) —
 * read its date with isoDate() and its hour with getUTCHours() (fed into
 * timeSlotIndexForHour() to find the earliest bookable slot on that date).
 *
 *  - Wedding/Kids cake in the cart: needs at least 24 hours' notice.
 *    Ordered by 8pm: earliest is this same time tomorrow. Ordered after
 *    8pm: the next day's kitchen slots are already full, so earliest
 *    becomes 9am the day *after* tomorrow.
 *  - Everything else (same-day eligible): a fixed daily cutoff
 *    (SAME_DAY_CUTOFF_HOUR). Ordered before the cutoff, "today" is still
 *    on the table, but only for a slot starting at least PREP_BUFFER_HOURS
 *    from now. Ordered at or after the cutoff, "today" isn't offered at
 *    all — earliest becomes 9am tomorrow.
 */
export function earliestDelivery(needsAdvanceNotice: boolean): Date {
  const now = shopNow();

  if (needsAdvanceNotice) {
    const cutoff = new Date(now);
    cutoff.setUTCHours(20, 0, 0, 0);
    if (now.getTime() <= cutoff.getTime()) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const dayAfterTomorrowNineAm = new Date(now);
    dayAfterTomorrowNineAm.setUTCDate(dayAfterTomorrowNineAm.getUTCDate() + 2);
    dayAfterTomorrowNineAm.setUTCHours(9, 0, 0, 0);
    return dayAfterTomorrowNineAm;
  }

  const cutoff = new Date(now);
  cutoff.setUTCHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  if (now.getTime() >= cutoff.getTime()) {
    const tomorrowNineAm = new Date(now);
    tomorrowNineAm.setUTCDate(tomorrowNineAm.getUTCDate() + 1);
    tomorrowNineAm.setUTCHours(9, 0, 0, 0);
    return tomorrowNineAm;
  }

  return new Date(now.getTime() + PREP_BUFFER_HOURS * 60 * 60 * 1000);
}

/** Which TIME_SLOTS index a given shop-time hour (0-23) falls into. */
export function timeSlotIndexForHour(hour: number): number {
  if (hour < 12) return 0;
  if (hour < 15) return 1;
  return 2;
}

/** True before the daily same-day cutoff (shop/IST time) — i.e. "today" is still an offerable delivery date for same-day-eligible items. */
export function isSameDayStillBookable(): boolean {
  const now = shopNow();
  const cutoff = new Date(now);
  cutoff.setUTCHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  return now.getTime() < cutoff.getTime();
}
