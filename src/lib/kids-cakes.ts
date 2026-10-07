import { fetchProductsForCategory, fetchRowsForCategoryProducts } from "@/lib/supabase";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/image-fallback";

// Kids Cakes category ID already present in Supabase.
export const KIDS_CAKES_CATEGORY_ID = "8667695f-8522-4c09-9ccc-5c32d9f622b2";

export type KidsCakeVariant = {
  id: string;
  flavour: string;
  size: string;
  price: number;
  mrp?: number;
};

export type KidsCake = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  badge: string | null;
  deliveryEstimate: string | null;
  tabGroup: string | null;
  image: string;
  flavours: string[];
  sizes: string[];
  variants: KidsCakeVariant[];
  minPrice: number;
  maxPrice: number;
  /** MRP of whichever variant has `minPrice`, for the "From ₹X" card badge. */
  minPriceMrp?: number;
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
  flavour: string;
  size: string;
  price: number | string;
  mrp: number | string | null;
};

type ImageRow = {
  product_id: string;
  image_url: string | null;
};

export async function getKidsCakes(): Promise<KidsCake[]> {
  const { products, crossListedIds } = await fetchProductsForCategory<ProductRow>(
    KIDS_CAKES_CATEGORY_ID,
    "id,slug,name,description,badge,delivery_estimate,tab_group,image_url,out_of_stock",
    { active: "eq.true" },
  );

  if (products.length === 0) return [];

  const [variants, images] = await Promise.all([
    fetchRowsForCategoryProducts<VariantRow>(
      "product_variants",
      KIDS_CAKES_CATEGORY_ID,
      crossListedIds,
      "id,product_id,flavour,size,price,mrp",
      { active: "eq.true" },
      "product_id.asc,size.asc,flavour.asc",
    ),
    fetchRowsForCategoryProducts<ImageRow>(
      "product_images",
      KIDS_CAKES_CATEGORY_ID,
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
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      badge: product.badge,
      deliveryEstimate: product.delivery_estimate,
      tabGroup: product.tab_group,
      image: imageByProduct.get(product.id) ?? product.image_url ?? DEFAULT_PRODUCT_IMAGE,
      flavours: [...new Set(mappedVariants.map((variant) => variant.flavour))],
      sizes: [...new Set(mappedVariants.map((variant) => variant.size))],
      variants: mappedVariants,
      minPrice,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      minPriceMrp: minPriceVariant?.mrp,
      outOfStock: product.out_of_stock,
    };
  });
}

export async function getKidsCake(slug: string): Promise<KidsCake | undefined> {
  const cakes = await getKidsCakes();
  return cakes.find((cake) => cake.slug === slug);
}
