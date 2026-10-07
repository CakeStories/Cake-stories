import { fetchProductsForCategory, fetchRowsForCategoryProducts } from "@/lib/supabase";
export { flavourLabel } from "@/lib/flavours";

// This is the Wedding Cakes category ID already present in Supabase.
export const WEDDING_CAKES_CATEGORY_ID = "c0c23f7c-c460-41f1-844e-b78a918f2059";

const STORAGE_BASE =
  "https://nyigmtugjsktzkietgbc.supabase.co/storage/v1/object/public/product-images";

export type WeddingCakeVariant = {
  id: string;
  flavour: string;
  size: string;
  price: number;
  mrp?: number;
};

export type WeddingCake = {
  code: string;
  name: string;
  slug: string;
  badge: string | null;
  deliveryEstimate: string | null;
  tabGroup: string | null;
  image: string;
  flavours: string[];
  sizes: string[];
  variants: WeddingCakeVariant[];
  minPrice: number;
  maxPrice: number;
  /** MRP of whichever variant has `minPrice`, for the "From ₹X" card badge. */
  minPriceMrp?: number;
  outOfStock: boolean;
};

type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
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
  flavour: string;
  size: string;
  price: number | string;
  mrp: number | string | null;
};

type ImageRow = {
  product_id: string;
  image_url: string | null;
};

function codeFromSlug(slug: string): string {
  const match = slug.match(/wed\d+/i);
  return match ? match[0].toUpperCase() : slug.toUpperCase();
}

/** The original menu photos were uploaded as <CODE>.png; newer products use their own image_url. */
function fallbackImage(slug: string): string {
  return `${STORAGE_BASE}/${codeFromSlug(slug)}.png`;
}

/**
 * Every active wedding cake — the original WEDxxx menu designs plus anything
 * the shop owner adds or cross-lists from /manage — with only active sizes.
 */
export async function getWeddingCakes(): Promise<WeddingCake[]> {
  const { products, crossListedIds } = await fetchProductsForCategory<ProductRow>(
    WEDDING_CAKES_CATEGORY_ID,
    "id,category_id,name,slug,description,badge,delivery_estimate,tab_group,image_url,out_of_stock",
    { active: "eq.true" },
  );

  if (products.length === 0) return [];

  const [variants, images] = await Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      WEDDING_CAKES_CATEGORY_ID,
      crossListedIds,
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc,size.asc,flavour.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      WEDDING_CAKES_CATEGORY_ID,
      crossListedIds,
      "product_id,image_url",
      undefined,
      "product_id.asc",
    ),
  ]);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const variant of variants) {
    const existing = variantsByProduct.get(variant.product_id) ?? [];
    existing.push(variant);
    variantsByProduct.set(variant.product_id, existing);
  }

  const imageByProduct = new Map<string, string>();
  for (const image of images) {
    if (image.image_url && !imageByProduct.has(image.product_id)) {
      imageByProduct.set(image.product_id, image.image_url);
    }
  }

  return products
    .map((product) => {
      const productVariants = variantsByProduct.get(product.id) ?? [];
      const mappedVariants = productVariants.map((variant) => ({
        id: variant.id,
        flavour: variant.flavour,
        size: variant.size,
        price: Number(variant.price),
        mrp: variant.mrp != null ? Number(variant.mrp) : undefined,
      }));
      const prices = mappedVariants.map((variant) => variant.price).filter(Number.isFinite);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const minPriceVariant = mappedVariants.find((variant) => variant.price === minPrice);

      return {
        code: codeFromSlug(product.slug),
        name: product.name,
        slug: product.slug,
        badge: product.badge,
        deliveryEstimate: product.delivery_estimate,
        tabGroup: product.tab_group,
        image: imageByProduct.get(product.id) ?? product.image_url ?? fallbackImage(product.slug),
        flavours: [...new Set(mappedVariants.map((variant) => variant.flavour))],
        sizes: [...new Set(mappedVariants.map((variant) => variant.size))],
        variants: mappedVariants,
        minPrice,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        minPriceMrp: minPriceVariant?.mrp,
        outOfStock: product.out_of_stock,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
