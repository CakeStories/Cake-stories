import { createFileRoute } from "@tanstack/react-router";
import { basePathForCategorySlug, getCategories } from "@/lib/categories";
import { COLLECTIONS } from "@/lib/collections";
import { INFO_PAGES } from "@/lib/info-pages";
import { supabaseRest } from "@/lib/supabase";

/**
 * /sitemap.xml for search engines, built from the live catalogue on each
 * request: every visible category, every active cake in a visible category,
 * the Celebration Collection and the information pages. Cakes added or hidden
 * in the admin panel show up (or drop out) automatically.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const categories = await getCategories();
        const products = await supabaseRest<{ slug: string; category_id: string | null; updated_at: string | null }>(
          "products",
          { select: "slug,category_id,updated_at", filters: { active: "eq.true" }, order: "slug.asc" },
        );

        const slugById = new Map(categories.map((c) => [c.id, c.slug]));
        const urls: { path: string; lastmod?: string; priority: string }[] = [
          { path: "/", priority: "1.0" },
          ...categories.map((c) => ({ path: `/category/${c.slug}`, priority: "0.9" })),
          ...COLLECTIONS.map((c) => ({ path: `/collection/${c.slug}`, priority: "0.7" })),
          ...INFO_PAGES.map((p) => ({ path: `/info/${p.slug}`, priority: "0.4" })),
        ];
        const seen = new Set(urls.map((u) => u.path));
        for (const product of products) {
          // Only cakes in a category customers can reach (hidden categories stay out).
          const categorySlug = product.category_id ? slugById.get(product.category_id) : undefined;
          if (!categorySlug) continue;
          const path = `${basePathForCategorySlug(categorySlug)}/${product.slug}`;
          if (seen.has(path)) continue;
          seen.add(path);
          urls.push({
            path,
            priority: "0.8",
            ...(product.updated_at && { lastmod: product.updated_at.slice(0, 10) }),
          });
        }

        const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls.map(
            (u) =>
              `  <url><loc>${escape(origin + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`,
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            // Fresh for an hour at Vercel's edge; new cakes appear within the hour.
            "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
