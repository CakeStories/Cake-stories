import { supabaseRest } from "@/lib/supabase";

export type Addon = {
  id: string;
  category: string;
  name: string;
  price: number;
  image: string | null;
};

type AddonRow = {
  id: string;
  category: string;
  name: string;
  price: number | string;
  image_url: string | null;
};

/** Active add-ons (candles, number candles, celebration essentials), in display order. */
export async function getAddons(): Promise<Addon[]> {
  const rows = await supabaseRest<AddonRow>("addons", {
    select: "id,category,name,price,image_url",
    filters: { active: "eq.true" },
    order: "category.asc,sort_order.asc",
  });

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    name: row.name,
    price: Number(row.price),
    image: row.image_url,
  }));
}

/** Groups a flat add-on list into { category: Addon[] } in first-seen order. */
export function groupAddonsByCategory(addons: Addon[]): Array<{ category: string; items: Addon[] }> {
  const order: string[] = [];
  const byCategory = new Map<string, Addon[]>();

  for (const addon of addons) {
    if (!byCategory.has(addon.category)) {
      byCategory.set(addon.category, []);
      order.push(addon.category);
    }
    byCategory.get(addon.category)!.push(addon);
  }

  return order.map((category) => ({ category, items: byCategory.get(category)! }));
}
