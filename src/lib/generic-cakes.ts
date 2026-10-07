import {
  supabaseRest,
  fetchProductsForCategory,
  fetchRowsForCategoryProducts,
} from "@/lib/supabase";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/image-fallback";

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

export type CharacterCakeGroup = {
  character: string;
  cakes: GenericCake[];
};

/**
 * The homepage "Character Cake" rail — every active product tagged with a
 * character_tag, grouped by that tag in first-seen order (folder order from
 * the shop owner's upload). Independent of the normal category browsing
 * path; these products live under a hidden category just so they still have
 * a valid category_id for product-detail lookups.
 */
export async function getCharacterCakes(categoryId: string): Promise<CharacterCakeGroup[]> {
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

  const groups = new Map<string, GenericCake[]>();
  for (const p of products) {
    const tag = p.character_tag?.trim();
    if (!tag) continue;
    const cake = toGenericCake(p, variantsByProduct.get(p.id) ?? [], imageByProduct.get(p.id));
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
