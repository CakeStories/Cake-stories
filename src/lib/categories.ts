import { supabaseRest } from "@/lib/supabase";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  bannerText: string | null;
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  banner_text: string | null;
};

/** All active categories, in the order the shop owner has set. */
export async function getCategories(): Promise<Category[]> {
  const rows = await supabaseRest<CategoryRow>("categories", {
    select: "id,slug,name,description,image_url,banner_text",
    filters: { active: "eq.true" },
    order: "sort_order.asc,name.asc",
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image_url,
    bannerText: row.banner_text,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

/** Which product detail route a category's products live at. Falls back to the general product page. */
export function basePathForCategorySlug(slug: string): string {
  if (slug === "birthday-cakes") return "/birthday-cake";
  if (slug === "wedding-cakes") return "/wedding-cake";
  if (slug === "kids-cakes") return "/kids-cake";
  return "/product";
}
