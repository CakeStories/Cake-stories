import { supabaseRest } from "@/lib/supabase";
import { getCategories, basePathForCategorySlug } from "@/lib/categories";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/image-fallback";

export type SearchResult = {
  id: string;
  slug: string;
  name: string;
  image: string;
  minPrice: number;
  minPriceMrp?: number;
  href: string;
  badge?: string | null;
  deliveryEstimate?: string | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  category_id: string;
  badge: string | null;
  delivery_estimate: string | null;
};

type VariantRow = {
  product_id: string;
  price: number | string;
  mrp: number | string | null;
};

type ImageRow = {
  product_id: string;
  image_url: string | null;
};

/**
 * Site-wide search across every real product — everything the shop owner
 * has added from /manage (wedding/birthday/kids cakes and any other
 * category, including the old hand-entered placeholder catalogue, which is
 * no longer surfaced anywhere on the site).
 */
export async function searchProducts(query: string): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const [products, categories] = await Promise.all([
    supabaseRest<ProductRow>("products", {
      select: "id,slug,name,image_url,category_id,badge,delivery_estimate",
      filters: { name: `ilike.*${term}*`, active: "eq.true" },
    }),
    getCategories(),
  ]);

  if (products.length === 0) {
    return [];
  }

  const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));
  const ids = products.map((p) => p.id);
  const idFilter = `in.(${ids.join(",")})`;

  const [variants, images] = await Promise.all([
    supabaseRest<VariantRow>("product_variants", {
      select: "product_id,price,mrp",
      filters: { product_id: idFilter, active: "eq.true" },
    }),
    supabaseRest<ImageRow>("product_images", {
      select: "product_id,image_url",
      filters: { product_id: idFilter },
    }),
  ]);

  const pricesByProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = pricesByProduct.get(v.product_id) ?? [];
    list.push(v);
    pricesByProduct.set(v.product_id, list);
  }
  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    if (img.image_url && !imageByProduct.has(img.product_id)) {
      imageByProduct.set(img.product_id, img.image_url);
    }
  }

  const supabaseMatches: SearchResult[] = products.map((p) => {
    const productVariants = pricesByProduct.get(p.id) ?? [];
    const prices = productVariants.map((v) => Number(v.price)).filter(Number.isFinite);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const minVariant = productVariants.find((v) => Number(v.price) === minPrice);
    const minPriceMrp = minVariant?.mrp != null ? Number(minVariant.mrp) : undefined;
    const categorySlug = categorySlugById.get(p.category_id);
    const basePath = categorySlug ? basePathForCategorySlug(categorySlug) : "/product";

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: imageByProduct.get(p.id) ?? p.image_url ?? DEFAULT_PRODUCT_IMAGE,
      minPrice,
      ...(minPriceMrp != null && { minPriceMrp }),
      href: `${basePath}/${p.slug}`,
      badge: p.badge,
      deliveryEstimate: p.delivery_estimate,
    };
  });

  return dedupeByName(supabaseMatches);
}

function dedupeByName(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
