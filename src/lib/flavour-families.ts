/**
 * Each "flavour for every craving" tile on the homepage actually represents
 * a group of distinct products from the printed menu (e.g. "Black Forest"
 * covers three separate designs: Deluxe, Heart Cake, and Celebration).
 *
 * Clicking the tile takes you to the first product in its group. On that
 * product's page, the "Flavour" selector lists every product in the same
 * group — picking a different one navigates to that product's own page
 * (its own image, description, sizes and prices), rather than changing a
 * variant within the same product.
 *
 * Slugs here must match real Birthday Cakes product slugs (see the
 * cakestories.in menu import). Order matters: the first slug in each group
 * is what a flavour tile link points to.
 */
export const FLAVOUR_FAMILIES: Record<string, string[]> = {
  "choco-truffle": ["ct001", "ct002", "ct003"],
  "romantic-red-velvet": ["rv001", "rv002", "rv003"],
  "white-forest": ["wf001", "wf002", "wf003"],
  "black-forest": ["bf001", "bf002", "bf003"],
  rasamalai: ["rs01", "rs02", "rs03"],
  "vancho-cake": ["va01", "va02", "va03"],
  "dream-cake": ["chocolate-dream-cake", "red-velvet-dream-cake", "mango-dream-cake", "rasamalai-dream-cake"],
  "black-currant": ["bc01", "bc02", "bc03"],
  strawberry: ["sb01", "sb02", "sb03"],
  pineapple: ["pa01", "pa02", "pa03"],
  kiwi: ["kw01", "kw02", "kw03"],
  mango: ["mg01", "mg02", "mg03"],
  blueberry: ["bb01", "bb02", "bb03"],
  "cheese-cake": [
    "blueberry-cheesecake",
    "mango-cheesecake",
    "trio-chocolate-cheesecake",
    "biscoff-cheesecake",
    "nutella-cheesecake",
  ],
};

/** The product slug a flavour tile's link should point to (its group's first member). */
export function firstSlugForFlavour(flavourSlug: string): string | undefined {
  return FLAVOUR_FAMILIES[flavourSlug]?.[0];
}

/** All slugs in the same group as `slug`, including itself — or just `[slug]` if it's not in any group. */
export function familyMembersFor(slug: string): string[] {
  for (const members of Object.values(FLAVOUR_FAMILIES)) {
    if (members.includes(slug)) return members;
  }
  return [slug];
}
