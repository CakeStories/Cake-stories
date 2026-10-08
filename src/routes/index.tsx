import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CakeSlice, ChevronLeft, ChevronRight, ShieldCheck, Star, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { ReviewsSection } from "@/components/reviews-section";
import { getCharacterCakes } from "@/lib/generic-cakes";
import { getBanners } from "@/lib/banners";
import { flavours } from "@/lib/flavour-list";
import bannerClassics from "@/assets/cake-stories-classics.jpg";
import bannerDesigner from "@/assets/cake-stories-designer.jpg";
import bannerCustomize from "@/assets/cake-stories-customize.jpg";

export const Route = createFileRoute("/")({
  loader: async () => {
    // Banners are a decoration, not critical data — if Supabase is briefly
    // unreachable or misconfigured, the homepage should still render with
    // the built-in fallback banners rather than failing to load at all.
    const dbBanners = await getBanners().catch(() => []);
    return { dbBanners };
  },
  head: () => ({
    meta: [
      { title: "Fresh Cakes Online in India | Cake Stories" },
      {
        name: "description",
        content:
          "Order handcrafted cakes for birthdays and celebrations. Freshly baked, eggless options, and same-day delivery from Cake Stories.",
      },
      { property: "og:title", content: "Fresh Cakes Online | Cake Stories" },
      {
        property: "og:description",
        content: "Handcrafted celebration cakes, baked fresh and delivered with care.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: CakeStore,
});

// Flavour thumbnails are stored in Supabase Storage under
// product-images/flavour-thumbnails.
const SUPABASE_STORAGE_BASE = "/sb/storage/v1/object/public/product-images"; // via our /sb proxy — see vite.config.ts

// Supports the common ways the PNGs may have been uploaded to Supabase:
// inside flavour-thumbnails/, directly in product-images/, or using the
// display name instead of the slug as the filename. The image automatically
// falls through to the next candidate if Supabase returns a 404.
function flavourImageCandidates(label: string, slug: string) {
  const names = [
    `${slug}.png`,
    `${label}.png`,
    `${label.toLowerCase()}.png`,
    `${label.replace(/\s+/g, "-").toLowerCase()}.png`,
  ];
  const uniqueNames = [...new Set(names)];
  return uniqueNames.flatMap((name) => [
    `${SUPABASE_STORAGE_BASE}/flavour-thumbnails/${encodeURIComponent(name)}`,
    `${SUPABASE_STORAGE_BASE}/${encodeURIComponent(name)}`,
  ]);
}

function FlavourThumbnail({ label, slug }: { label: string; slug: string }) {
  const candidates = flavourImageCandidates(label, slug);
  const [index, setIndex] = useState(0);
  const src = candidates[index];

  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      className="h-full w-full object-cover transition duration-300 hover:scale-105"
      onError={() => {
        if (index < candidates.length - 1) setIndex((current) => current + 1);
      }}
    />
  );
}

/** Scrolls a horizontal rail by roughly one screenful, left or right. */
function scrollByCards(ref: React.RefObject<HTMLDivElement | null>, direction: -1 | 1) {
  const el = ref.current;
  if (!el) return;
  el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
}

// Hidden "Character Cakes" category — these products aren't in the top nav
// (the category row is inactive), they only power the homepage Character
// Cake rail, grouped by their character_tag.
const CHARACTER_CAKES_CATEGORY_ID = "6ff19f6d-9551-4830-a306-206b80a3d5f9";

// "Cakes for every celebration" occasion rail — each card's own photo, from
// Supabase Storage, matching the occasion.
const CELEBRATION_IMAGE_BASE = "/sb/storage/v1/object/public/product-images"; // via our /sb proxy — see vite.config.ts
const celebrations: { label: string; category: string; image: string }[] = [
  {
    label: "First Birthday",
    category: "kids-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/kids/moonlight-blue-one.webp`,
  },
  {
    label: "Anniversary",
    category: "anniversary-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/anniversary/wa001.png`,
  },
  {
    label: "Birthday Bash",
    category: "birthday-bash",
    image: `${CELEBRATION_IMAGE_BASE}/birthday-bash/blue-gold-birthday-celebration.webp`,
  },
  {
    label: "Wedding",
    category: "wedding-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/wedding-cakes/wed001.webp`,
  },
  {
    label: "Holy Communion",
    category: "holy-communion-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/holy-communion/KIDS116-angel-blessing-baptism-cakestories.png`,
  },
];

// Hero carousel fallback — used only until the shop owner adds banners in
// the admin dashboard. Each of these images has text and CTA baked into the
// artwork, so the slide itself is just a clickable link over the image.
const fallbackBanners: {
  image: string;
  label: string; // accessible label only, not rendered
  href: string;
  external?: boolean;
}[] = [
  {
    image: bannerClassics,
    label:
      "Cake Stories Classics — Chocolate Truffle, Red Velvet, Butterscotch & more, view our classics",
    href: "/category/birthday-cakes",
  },
  {
    image: bannerDesigner,
    label: "Designer Cakes — explore custom-designed cakes",
    href: "/category/party-essentials",
  },
  {
    image: bannerCustomize,
    label: "Customize Your Cakes — chat with our expert on WhatsApp",
    href: "https://wa.me/917907518447",
    external: true,
  },
];

function CakeStore() {
  const { dbBanners } = Route.useLoaderData();
  const flavourScrollRef = useRef<HTMLDivElement>(null);
  const characterScrollRef = useRef<HTMLDivElement>(null);
  const [bannerIndex, setBannerIndex] = useState(0);

  // Banners configured in the admin dashboard take over once at least one exists;
  // otherwise keep showing the built-in artwork so the homepage never goes blank.
  const banners = dbBanners.length > 0 ? dbBanners : fallbackBanners;

  useEffect(() => {
    setBannerIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(
      () => setBannerIndex((index) => (index + 1) % banners.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const { data: characterGroups = [] } = useQuery({
    queryKey: ["character-cakes"],
    queryFn: () => getCharacterCakes(CHARACTER_CAKES_CATEGORY_ID),
    staleTime: 5 * 60_000,
  });
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);
  const activeGroup =
    characterGroups.find((group) => group.character === activeCharacter) ?? characterGroups[0];

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <h1 className="sr-only">Cake Stories — Fresh, handcrafted cakes for every celebration</h1>
        <section
          className="relative mt-6 aspect-[3/1] w-full overflow-hidden rounded-lg lg:w-[calc(100%+3rem)] lg:-mx-6"
          aria-roledescription="carousel"
          aria-label="Cake Stories offers"
        >
          {banners.map((banner, index) =>
            banner.external ? (
              <a
                key={`${banner.href}-${index}`}
                href={banner.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-hidden={index !== bannerIndex}
                tabIndex={index === bannerIndex ? 0 : -1}
                aria-label={banner.label}
                className={`absolute inset-0 transition-opacity duration-700 ${index === bannerIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
                <img
                  src={banner.image}
                  width={1600}
                  height={533}
                  alt=""
                  fetchPriority={index === 0 ? "high" : undefined}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-center"
                />
              </a>
            ) : (
              <Link
                key={`${banner.href}-${index}`}
                to={banner.href}
                aria-hidden={index !== bannerIndex}
                tabIndex={index === bannerIndex ? 0 : -1}
                aria-label={banner.label}
                className={`absolute inset-0 transition-opacity duration-700 ${index === bannerIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
                <img
                  src={banner.image}
                  width={1600}
                  height={533}
                  alt=""
                  fetchPriority={index === 0 ? "high" : undefined}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover object-center"
                />
              </Link>
            ),
          )}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {banners.map((banner, index) => (
              <button
                key={`${banner.href}-${index}`}
                type="button"
                aria-label={`Show banner ${index + 1}`}
                onClick={() => setBannerIndex(index)}
                className={`h-2 rounded-full transition-all ${index === bannerIndex ? "w-7 bg-primary" : "w-2 bg-background/80"}`}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 border-b border-border py-5 sm:grid-cols-4">
          {[
            { icon: Star, top: "4.9 loved", bottom: "by 8,000+ customers" },
            { icon: CakeSlice, top: "Baked fresh", bottom: "after you order" },
            { icon: Truck, top: "Same-day", bottom: "delivery available" },
            { icon: ShieldCheck, top: "Quality checked", bottom: "every single time" },
          ].map(({ icon: Icon, top, bottom }) => (
            <div key={top} className="flex items-center gap-3 px-3 py-2 sm:justify-center">
              <Icon size={21} className="shrink-0 text-primary" />
              <span>
                <strong className="block text-sm">{top}</strong>
                <span className="text-xs text-muted-foreground">{bottom}</span>
              </span>
            </div>
          ))}
        </div>

        <section className="py-9">
          <h2 className="font-display text-3xl">A flavour for every craving</h2>
          <div className="relative mt-5">
            <div
              ref={flavourScrollRef}
              className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-3"
            >
              {flavours.map((flavour) => (
                <Link
                  key={flavour.label}
                  to="/flavour/$flavourSlug"
                  params={{ flavourSlug: flavour.slug }}
                  className="w-28 shrink-0 snap-start text-center sm:w-32"
                >
                  <span className="block aspect-square overflow-hidden rounded-md border border-border bg-muted">
                    <FlavourThumbnail label={flavour.label} slug={flavour.slug} />
                  </span>
                  <span className="mt-2 block min-h-9 text-xs font-semibold leading-4 sm:text-sm">
                    {flavour.label}
                  </span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              aria-label="Scroll flavours left"
              onClick={() => scrollByCards(flavourScrollRef, -1)}
              className="absolute left-0 top-1/2 hidden -translate-x-3 -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Scroll flavours right"
              onClick={() => scrollByCards(flavourScrollRef, 1)}
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-3 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <section className="border-t border-border py-9">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
            Cakes for every celebration
          </h2>
          <div className="scrollbar-none mt-5 flex snap-x gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
            {celebrations.map((occasion) => (
              <Link
                key={occasion.label}
                to="/category/$categorySlug"
                params={{ categorySlug: occasion.category }}
                className="group relative h-44 w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-[#f3e3cf] p-4 sm:w-auto"
              >
                <img
                  src={occasion.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-y-0 right-0 h-full w-[58%] object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="relative z-10 max-w-[48%]">
                  <h3 className="text-base font-bold leading-tight text-foreground">
                    {occasion.label}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold shadow-sm">
                    Order Now
                    <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {characterGroups.length > 0 && activeGroup && (
          <section id="shop" className="scroll-mt-24 border-t border-border py-10">
            <h2 className="font-display text-3xl">Character Cake</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a favourite character to see their cakes.
            </p>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {characterGroups.map((group) => (
                <button
                  key={group.character}
                  type="button"
                  onClick={() => setActiveCharacter(group.character)}
                  aria-pressed={group.character === activeGroup.character}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    group.character === activeGroup.character
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  {group.character}
                </button>
              ))}
            </div>

            <div className="relative mt-6">
              <div
                ref={characterScrollRef}
                className="scrollbar-none flex snap-x gap-3 overflow-x-auto pb-1"
              >
                {activeGroup.cakes.map((cake) => (
                  <div key={cake.id} className="w-40 shrink-0 snap-start sm:w-48">
                    <CakeCard
                      href={`/product/${cake.slug}`}
                      image={cake.image}
                      title={cake.name}
                      badge={cake.badge}
                      minPrice={cake.minPrice}
                      {...(cake.minPriceMrp != null && { minPriceMrp: cake.minPriceMrp })}
                      deliveryEstimate={cake.deliveryEstimate}
                      outOfStock={cake.outOfStock}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollByCards(characterScrollRef, -1)}
                className="absolute -left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-sm hover:bg-muted sm:flex"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollByCards(characterScrollRef, 1)}
                className="absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-sm hover:bg-muted sm:flex"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}
      </div>

      <ReviewsSection />

      <SiteFooter />
    </main>
  );
}
