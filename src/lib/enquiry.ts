/**
 * Which cakes are sold online and which are "enquire on WhatsApp".
 *
 * Customisable cakes (Wedding, Kids, Holy Communion, Anniversary, Birthday
 * Bash, Character cakes — and any category added later) have no price on the
 * site: the customer picks flavour and size and enquires on WhatsApp, where
 * extra toppings, flowers and the price are agreed. Only these categories
 * keep prices, the cart and checkout:
 */
export const PRICED_CATEGORY_SLUGS: ReadonlySet<string> = new Set([
  "birthday-cakes",
  "party-essentials",
  "sweet-treats",
]);

/** The same categories by id, for the server (checkout) and product rows. */
export const PRICED_CATEGORY_IDS: ReadonlySet<string> = new Set([
  "a9109392-32e1-4b67-ba87-036a7bbeaf52", // birthday-cakes
  "11baa536-a88a-4ea6-991e-a60e2ee6ac03", // party-essentials
  "b308db06-d6a5-4d6f-9138-84f0fb7f138f", // sweet-treats
]);

/** True for a customisable (enquire-only) category, by slug. Unknown → enquiry. */
export function isEnquiryCategory(slug: string | null | undefined): boolean {
  return !PRICED_CATEGORY_SLUGS.has(slug ?? "");
}

/** True for a customisable (enquire-only) category, by id. Unknown → enquiry. */
export function isEnquiryCategoryId(id: string | null | undefined): boolean {
  return !PRICED_CATEGORY_IDS.has(id ?? "");
}

/** Wishlist/cart lines only keep a link: Kids and Wedding cake pages are always enquiry. */
export function isEnquiryHref(href: string | undefined): boolean {
  return Boolean(href && (href.startsWith("/kids-cake/") || href.startsWith("/wedding-cake/")));
}
