import { fetchProductsForCategory, fetchRowsForCategoryProducts } from "@/lib/supabase";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/image-fallback";

// Birthday Cakes category ID already present in Supabase.
export const BIRTHDAY_CAKES_CATEGORY_ID = "a9109392-32e1-4b67-ba87-036a7bbeaf52";

export type BirthdayCakeVariant = {
  id: string;
  size: string;
  price: number;
  mrp?: number;
};

export type BirthdayCake = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  badge: string | null;
  deliveryEstimate: string | null;
  tabGroup: string | null;
  image: string;
  sizes: string[];
  variants: BirthdayCakeVariant[];
  minPrice: number;
  maxPrice: number;
  /** MRP of whichever variant has `minPrice`, for the "From ₹X" card badge. */
  minPriceMrp?: number;
  /** Largest discount % across all sizes, or null if none are discounted. */
  maxDiscountPercent: number | null;
  outOfStock: boolean;
};

type ProductRow = {
  id: string;
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
  size: string;
  price: number | string;
  mrp: number | string | null;
};

type ImageRow = {
  product_id: string;
  image_url: string | null;
};

// Sort sizes in a sensible order (0.5 kg, 1 kg, 1.5 kg, ... then anything else alphabetically).
function sizeWeight(size: string): number {
  const match = size.match(/([\d.]+)\s*kg/i);
  if (match) return Number(match[1]);
  return Number.POSITIVE_INFINITY;
}

export async function getBirthdayCakes(): Promise<BirthdayCake[]> {
  const { products, crossListedIds } = await fetchProductsForCategory<ProductRow>(
    BIRTHDAY_CAKES_CATEGORY_ID,
    "id,slug,name,description,badge,delivery_estimate,tab_group,image_url,out_of_stock",
    { active: "eq.true" },
  );

  if (products.length === 0) return [];

  const [variants, images] = await Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      BIRTHDAY_CAKES_CATEGORY_ID,
      crossListedIds,
      "id,product_id,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      BIRTHDAY_CAKES_CATEGORY_ID,
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

  return products.map((product) => {
    const productVariants = (variantsByProduct.get(product.id) ?? [])
      .map((variant) => ({
        id: variant.id,
        size: variant.size,
        price: Number(variant.price),
        mrp: variant.mrp != null ? Number(variant.mrp) : undefined,
      }))
      .sort((a, b) => sizeWeight(a.size) - sizeWeight(b.size));

    const prices = productVariants.map((variant) => variant.price).filter(Number.isFinite);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const minPriceVariant = productVariants.find((variant) => variant.price === minPrice);

    const discountPercents = productVariants
      .map((variant) =>
        variant.mrp && variant.mrp > variant.price
          ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100)
          : null,
      )
      .filter((pct): pct is number => pct !== null);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      badge: product.badge,
      deliveryEstimate: product.delivery_estimate,
      tabGroup: product.tab_group,
      image: imageByProduct.get(product.id) ?? product.image_url ?? DEFAULT_PRODUCT_IMAGE,
      sizes: [...new Set(productVariants.map((variant) => variant.size))],
      variants: productVariants,
      minPrice,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      minPriceMrp: minPriceVariant?.mrp,
      maxDiscountPercent: discountPercents.length ? Math.max(...discountPercents) : null,
      outOfStock: product.out_of_stock,
    };
  });
}

export async function getBirthdayCake(slug: string): Promise<BirthdayCake | undefined> {
  const cakes = await getBirthdayCakes();
  return cakes.find((cake) => cake.slug === slug);
}
