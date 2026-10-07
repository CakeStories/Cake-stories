import { supabaseRest } from "@/lib/supabase";

export type Banner = {
  id: string;
  label: string;
  image: string;
  href: string;
  external: boolean;
};

type BannerRow = {
  id: string;
  label: string;
  image_url: string;
  link_url: string;
  external: boolean;
};

function mapBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    label: row.label,
    image: row.image_url,
    href: row.link_url,
    // Self-heal here too: a link that's clearly external (http/https, e.g. a
    // wa.me WhatsApp link) always opens as external, even if an older row
    // was saved before this was made automatic.
    external: row.external || /^https?:\/\//i.test(row.link_url),
  };
}

/** Active homepage banners, in display order. Empty array if none are configured yet. */
export async function getBanners(): Promise<Banner[]> {
  const rows = await supabaseRest<BannerRow>("banners", {
    select: "id,label,image_url,link_url,external",
    filters: { active: "eq.true", category_id: "is.null" },
    order: "sort_order.asc,created_at.asc",
  });

  return rows.map(mapBanner);
}

/** Active banners for one category page, split by where they should show. */
export async function getCategoryBanners(categoryId: string): Promise<{ top: Banner[]; bottom: Banner[] }> {
  const rows = await supabaseRest<BannerRow & { position: "top" | "bottom" }>("banners", {
    select: "id,label,image_url,link_url,external,position",
    filters: { active: "eq.true", category_id: `eq.${categoryId}` },
    order: "sort_order.asc,created_at.asc",
  });

  return {
    top: rows.filter((row) => row.position !== "bottom").map(mapBanner),
    bottom: rows.filter((row) => row.position === "bottom").map(mapBanner),
  };
}
