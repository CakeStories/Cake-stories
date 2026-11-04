import { categories as STATIC_CATEGORIES } from "@/lib/static-categories";
import { COLLECTIONS } from "@/lib/collections";
import { INFO_PAGES } from "@/lib/info-pages";
import { DEFAULT_WHATSAPP_NUMBER, whatsappDigits } from "@/lib/whatsapp";

export type SitePage = { group: string; label: string; href: string };

/**
 * Every page a banner or tile can point to, for the "Pick a page" lists in
 * the admin panel and the website editor — so the owner never has to type a
 * web address. Pass the live category list when it's to hand (the admin
 * panel has it); otherwise the built-in one is used.
 */
export function sitePages(
  categories: { slug: string; name: string }[] = STATIC_CATEGORIES.map((c) => ({ slug: c.slug, name: c.label })),
  whatsappNumber: string = DEFAULT_WHATSAPP_NUMBER,
): SitePage[] {
  return [
    { group: "Main", label: "Homepage", href: "/" },
    ...categories.map((c) => ({ group: "Categories", label: c.name, href: `/category/${c.slug}` })),
    ...COLLECTIONS.map((c) => ({ group: "Celebration Collection", label: c.label, href: `/collection/${c.slug}` })),
    ...INFO_PAGES.map((p) => ({ group: "Information", label: p.title, href: `/info/${p.slug}` })),
    { group: "Main", label: "Search all cakes", href: "/search" },
    { group: "Main", label: "WhatsApp chat", href: `https://wa.me/${whatsappDigits(whatsappNumber)}` },
  ];
}

/** The page list grouped for an <optgroup> dropdown, in a fixed order. */
export function groupedSitePages(pages: SitePage[]): [string, SitePage[]][] {
  const groups = new Map<string, SitePage[]>();
  for (const page of pages) groups.set(page.group, [...(groups.get(page.group) ?? []), page]);
  return [...groups];
}
