import { getCakesForCategory } from "@/lib/generic-cakes";

// Party Essentials category ID already present in Supabase.
export const PARTY_ESSENTIALS_CATEGORY_ID = "11baa536-a88a-4ea6-991e-a60e2ee6ac03";

export type PartyEssentialItem = {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  mrp?: number;
  /** The cheapest variant's id — what the "+" stepper actually adds to the cart. */
  variantId: string | undefined;
};

/**
 * The small "Make it special" strip shown on every cake's product page —
 * candles, poppers and other Party Essentials the shopper can add on.
 * `excludeSlug` drops the current product itself, in case it's ever cross-listed here.
 */
export async function getPartyEssentials(excludeSlug?: string): Promise<PartyEssentialItem[]> {
  const items = await getCakesForCategory(PARTY_ESSENTIALS_CATEGORY_ID);
  return items
    .filter((item) => item.slug !== excludeSlug)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      image: item.image,
      price: item.minPrice,
      ...(item.minPriceMrp != null && { mrp: item.minPriceMrp }),
      variantId: item.variants.find((v) => v.price === item.minPrice)?.id,
    }));
}
