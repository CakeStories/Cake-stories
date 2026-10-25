import { getSupabaseConfig } from "@/lib/supabase";

/**
 * Text and photos changed from the website editor (/manage → "Edit website").
 * They live in one small JSON file in Supabase Storage — { "home.celebrations.title": "…" } —
 * and anything not in it shows the built-in default written in the page code.
 */
export type SiteContent = Record<string, string>;

export const SITE_CONTENT_PATH = "site-content/content.json";

export async function fetchSiteContent(): Promise<SiteContent> {
  try {
    const { url } = getSupabaseConfig();
    // A fresh query string every 30 s gets past any CDN copy of the file.
    const version = Math.floor(Date.now() / 30_000);
    const response = await fetch(
      `${url}/storage/v1/object/public/product-images/${SITE_CONTENT_PATH}?v=${version}`,
      { cache: "no-store" },
    );
    if (!response.ok) return {};
    const content = (await response.json()) as unknown;
    return content && typeof content === "object" ? (content as SiteContent) : {};
  } catch {
    // The page should never fail to load over this — fall back to the defaults.
    return {};
  }
}
