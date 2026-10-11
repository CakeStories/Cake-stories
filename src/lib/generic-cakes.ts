import {
  supabaseRest,
  fetchProductsForCategory,
  fetchRowsForCategoryProducts,
} from "@/lib/supabase";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/image-fallback";
import { KIDS_CAKES_CATEGORY_ID } from "@/lib/kids-cakes";

export type GenericCakeVariant = {
  id: string;
  flavour: string | null;
  size: string | null;
  price: number;
  mrp?: number;
};

export type GenericCake = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  badge: string | null;
  deliveryEstimate: string | null;
  tabGroup: string | null;
  image: string;
  categoryId: string;
  flavours: string[];
  sizes: string[];
  variants: GenericCakeVariant[];
  minPrice: number;
  maxPrice: number;
  minPriceMrp?: number;
  outOfStock: boolean;
};

type ProductRow = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  badge: string | null;
  delivery_estimate: string | null;
  tab_group: string | null;
  image_url: string | null;
  out_of_stock: boolean;
};

type VariantRow = {
  id: string;
  product_id: string;
  flavour: string | null;
  size: string | null;
  price: number | string;
  mrp: number | string | null;
};

type ImageRow = {
  product_id: string;
  image_url: string | null;
};

function toGenericCake(
  product: ProductRow,
  variants: VariantRow[],
  image: string | undefined,
): GenericCake {
  const mappedVariants = variants.map((v) => ({
    id: v.id,
    flavour: v.flavour,
    size: v.size,
    price: Number(v.price),
    mrp: v.mrp != null ? Number(v.mrp) : undefined,
  }));
  const prices = mappedVariants.map((v) => v.price).filter(Number.isFinite);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const minPriceVariant = mappedVariants.find((v) => v.price === minPrice);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    badge: product.badge,
    deliveryEstimate: product.delivery_estimate,
    tabGroup: product.tab_group,
    image: image ?? product.image_url ?? DEFAULT_PRODUCT_IMAGE,
    categoryId: product.category_id,
    flavours: [
      ...new Set(mappedVariants.map((v) => v.flavour).filter((f): f is string => Boolean(f))),
    ],
    sizes: [...new Set(mappedVariants.map((v) => v.size).filter((s): s is string => Boolean(s)))],
    variants: mappedVariants,
    minPrice,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    minPriceMrp: minPriceVariant?.mrp,
    outOfStock: product.out_of_stock,
  };
}

/** Every active Supabase-backed product assigned to OR cross-listed into a category — used for categories the shop owner manages from /manage (including new ones they create themselves). */
export async function getCakesForCategory(categoryId: string): Promise<GenericCake[]> {
  // Prices and photos for the category's own products don't depend on the
  // product list, so start them now; the identical requests below reuse these.
  void Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      categoryId,
      [],
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      categoryId,
      [],
      "product_id,image_url",
      undefined,
      "product_id.asc",
    ),
  ]).catch(() => {});
  const { products, crossListedIds } = await fetchProductsForCategory<ProductRow>(
    categoryId,
    "id,category_id,slug,name,description,badge,delivery_estimate,tab_group,image_url,out_of_stock",
    { active: "eq.true" },
  );

  if (products.length === 0) return [];

  const [variants, images] = await Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      categoryId,
      crossListedIds,
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      categoryId,
      crossListedIds,
      "product_id,image_url",
      undefined,
      "product_id.asc",
    ),
  ]);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }
  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    if (img.image_url && !imageByProduct.has(img.product_id))
      imageByProduct.set(img.product_id, img.image_url);
  }

  return products.map((p) =>
    toGenericCake(p, variantsByProduct.get(p.id) ?? [], imageByProduct.get(p.id)),
  );
}

/** Hidden "Character Cakes" category — feeds the homepage and Kids Cakes character rails. */
export const CHARACTER_CAKES_CATEGORY_ID = "6ff19f6d-9551-4830-a306-206b80a3d5f9";

/** A character cake plus where its card should link (its own page, or the matching Kids Cakes product). */
export type CharacterCake = GenericCake & { href: string };

export type CharacterCakeGroup = {
  character: string;
  cakes: CharacterCake[];
};


/** "Chase & Friends  Bash" and "Chase and Friends Bash" give the same key. */
const nameKey = (name: string) =>
  name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

/**
 * The Kids Cakes design for a character cake: the same name, or failing that
 * a Kids Cakes name that is the start of it ("Adventure Bay" for "Adventure
 * Bay Celebration"). Short names are skipped so "Bluey" can't match every Bluey cake.
 */
function findKidsTwin<T>(byName: Map<string, T>, name: string): T | undefined {
  const key = nameKey(name);
  const exact = byName.get(key);
  if (exact) return exact;
  for (const [kidsKey, value] of byName) {
    if (kidsKey.length >= 10 && key.startsWith(kidsKey)) return value;
  }
  return undefined;
}

type KidsPriceRow = {
  name: string;
  slug: string;
  product_variants: Array<{ price: number | string; mrp: number | string | null; active: boolean }>;
};

/**
 * Most character cakes are copies of a Kids Cakes design (same name) whose
 * prices live on the Kids Cakes product. Returns each Kids Cakes design's
 * starting price, keyed by name, so an unpriced character cake can show it
 * and link to the Kids Cakes product, where the customer picks a size.
 */
async function kidsCakePricesByName(): Promise<
  Map<string, { slug: string; minPrice: number; minPriceMrp?: number }>
> {
  const rows = await supabaseRest<KidsPriceRow>("products", {
    select: "name,slug,product_variants(price,mrp,active)",
    filters: { category_id: `eq.${KIDS_CAKES_CATEGORY_ID}`, active: "eq.true" },
  });
  const byName = new Map<string, { slug: string; minPrice: number; minPriceMrp?: number }>();
  for (const row of rows) {
    const priced = row.product_variants
      .filter((v) => v.active && Number(v.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price));
    const cheapest = priced[0];
    if (!cheapest) continue;
    byName.set(nameKey(row.name), {
      slug: row.slug,
      minPrice: Number(cheapest.price),
      ...(cheapest.mrp != null && { minPriceMrp: Number(cheapest.mrp) }),
    });
  }
  return byName;
}

/**
 * The homepage "Character Cake" rail — every active product tagged with a
 * character_tag, grouped by that tag in first-seen order (folder order from
 * the shop owner's upload). Independent of the normal category browsing
 * path; these products live under a hidden category just so they still have
 * a valid category_id for product-detail lookups.
 */
export async function getCharacterCakes(categoryId: string): Promise<CharacterCakeGroup[]> {
  // Independent of everything below — start it straight away.
  const kidsPricesPromise = kidsCakePricesByName().catch(() => new Map<string, never>());
  // Prices and photos for the category's own products don't depend on the
  // product list, so start them now; the identical requests below reuse these.
  void Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      categoryId,
      [],
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      categoryId,
      [],
      "product_id,image_url",
      undefined,
      "product_id.asc",
    ),
  ]).catch(() => {});
  const { products, crossListedIds } = await fetchProductsForCategory<
    ProductRow & { character_tag: string | null }
  >(categoryId, "id,category_id,slug,name,description,badge,delivery_estimate,tab_group,image_url,out_of_stock,character_tag", {
    active: "eq.true",
  });

  if (products.length === 0) return [];

  const [variants, images] = await Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      categoryId,
      crossListedIds,
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      categoryId,
      crossListedIds,
      "product_id,image_url",
      undefined,
      "product_id.asc",
    ),
  ]);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }
  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    if (img.image_url && !imageByProduct.has(img.product_id))
      imageByProduct.set(img.product_id, img.image_url);
  }

  const kidsPrices = await kidsPricesPromise;

  const groups = new Map<string, CharacterCake[]>();
  for (const p of products) {
    const tag = p.character_tag?.trim();
    if (!tag) continue;
    const own = toGenericCake(p, variantsByProduct.get(p.id) ?? [], imageByProduct.get(p.id));
    const kids = own.minPrice > 0 ? undefined : findKidsTwin(kidsPrices, own.name);
    const cake: CharacterCake = kids
      ? {
          ...own,
          minPrice: kids.minPrice,
          ...(kids.minPriceMrp != null ? { minPriceMrp: kids.minPriceMrp } : {}),
          href: `/kids-cake/${kids.slug}`,
        }
      : { ...own, href: `/product/${own.slug}` };
    // No price of its own and no priced Kids Cakes twin: keep it out of the
    // character rails until a price is set in /manage (no "Price on request").
    if (cake.minPrice <= 0) continue;
    const list = groups.get(tag) ?? [];
    list.push(cake);
    groups.set(tag, list);
  }

  return [...groups.entries()]
    .map(([character, cakes]) => ({
      character,
      cakes: [...cakes].sort((a, b) => a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => a.character.localeCompare(b.character));
}

/**
 * Looks up a product by slug across every category, for the general product
 * page — this is the fallback when a slug isn't one of catalog.ts's
 * hardcoded products (i.e. it's something the shop owner added themselves).
 */
export async function getCakeBySlugAnywhere(slug: string): Promise<GenericCake | undefined> {
  const products = await supabaseRest<ProductRow>("products", {
    select: "id,category_id,slug,name,description,badge,delivery_estimate,tab_group,image_url,out_of_stock",
    filters: { slug: `eq.${slug}`, active: "eq.true" },
  });
  const product = products[0];
  if (!product) return undefined;

  const [variants, images] = await Promise.all([
    supabaseRest<VariantRow>("product_variants", {
      select: "id,product_id,flavour,size,price,mrp",
      filters: { product_id: `eq.${product.id}`, active: "eq.true" },
    }),
    supabaseRest<ImageRow>("product_images", {
      select: "product_id,image_url",
      filters: { product_id: `eq.${product.id}` },
    }),
  ]);

  return toGenericCake(product, variants, images[0]?.image_url ?? undefined);
}
