import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CakeSlice, ChevronLeft, ChevronRight, ShieldCheck, Star, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { CakeTabsRail, type TabbedCake } from "@/components/cake-tabs-rail";
import { characterIcon } from "@/lib/character-icons";
import { ReviewsSection } from "@/components/reviews-section";
import { CHARACTER_CAKES_CATEGORY_ID, getCakesForCategory, getCharacterCakes } from "@/lib/generic-cakes";
import { COLLECTIONS } from "@/lib/collections";
import { getBanners } from "@/lib/banners";
import { flavours } from "@/lib/flavour-list";
import bannerClassics from "@/assets/cake-stories-classics.jpg";
import bannerDesigner from "@/assets/cake-stories-designer.jpg";
import bannerCustomize from "@/assets/cake-stories-customize.jpg";
import { resizedImageUrl, responsiveImage } from "@/lib/supabase";
import { AdminShortcut, EditableImage, EditableText } from "@/components/editable";
import { useEditMode } from "@/lib/edit-mode";

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
    links: [
      { rel: "canonical", href: "/" },
    ],
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

/** Hero banner widths for every screen, from phones to large desktops. */
function heroSrcSet(image: string): string | undefined {
  const at = (w: number) => resizedImageUrl(image, w, 75);
  if (at(640) === image) return undefined; // not a Supabase photo (bundled artwork)
  return [640, 960, 1280, 1920].map((w) => `${at(w)} ${w}w`).join(", ");
}

/** One hero slide's photo; in the website editor it can be swapped in place. */
function HeroImage({ banner, index }: { banner: { id?: string; image: string }; index: number }) {
  const { saveBannerImage } = useEditMode();
  const bannerId = banner.id;
  return (
    <EditableImage
      // Admin banners save to the banner itself; the built-in artwork is replaced per slide.
      {...(bannerId ? { onSave: (url: string) => saveBannerImage(bannerId, url) } : { id: `home.hero.${index}` })}
      fallback={banner.image}
      buttonPosition="left-3 top-3"
    >
      {(image) => (
        <img
          src={resizedImageUrl(image, 1280, 75)}
          srcSet={heroSrcSet(image)}
          sizes="(min-width: 1280px) 1280px, 100vw"
          width={1600}
          height={533}
          alt=""
          fetchPriority={index === 0 ? "high" : undefined}
          loading={index === 0 ? "eager" : "lazy"}
          className="h-full w-full object-cover object-center"
        />
      )}
    </EditableImage>
  );
}

function FlavourThumbnail({ label, slug }: { label: string; slug: string }) {
  const candidates = flavourImageCandidates(label, slug);
  const [index, setIndex] = useState(0);
  const src = candidates[index];

  return (
    <img
      src={src && resizedImageUrl(src, 256)}
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

// "Cakes for every celebration" banners — each one's own photo, from
// Supabase Storage, with a short two-line description.
const CELEBRATION_IMAGE_BASE = "/sb/storage/v1/object/public/product-images"; // via our /sb proxy — see vite.config.ts
// "Sweet Treats & More" — real products in that category, shown in this order.
const SWEET_TREATS_CATEGORY_ID = "b308db06-d6a5-4d6f-9138-84f0fb7f138f";
const SWEET_TREATS_ORDER = [
  "butter-melties",
  "masala-cookies",
  "butter-cookies",
  "cashew-cookies",
  "tiramisu",
  "donut-3-in-1-pack",
  "brownie-tub",
  "brownie-piece",
];

const celebrations: { label: string; description: string; category: string; image: string }[] = [
  {
    label: "First Birthday",
    description: "Themed cakes for their very first birthday.",
    category: "kids-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/kids/moonlight-blue-one.webp`,
  },
  {
    label: "Anniversary",
    description: "Romantic cakes for every year of love.",
    category: "anniversary-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/anniversary/wa001.png`,
  },
  {
    label: "Birthday Bash",
    description: "Show-stopping cakes for big birthday parties.",
    category: "birthday-bash",
    image: `${CELEBRATION_IMAGE_BASE}/birthday-bash/blue-gold-birthday-celebration.webp`,
  },
  {
    label: "Wedding",
    description: "Elegant tiered cakes for your big day.",
    category: "wedding-cakes",
    image: `${CELEBRATION_IMAGE_BASE}/wedding-cakes/wed001.webp`,
  },
  {
    label: "Holy Communion",
    description: "Graceful cakes for a blessed celebration.",
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
  const { saveProduct } = useEditMode();
  const flavourScrollRef = useRef<HTMLDivElement>(null);
  const celebrationScrollRef = useRef<HTMLDivElement>(null);
  const collectionScrollRef = useRef<HTMLDivElement>(null);
  const sweetsScrollRef = useRef<HTMLDivElement>(null);
  const { data: sweetTreatsData = [] } = useQuery({
    queryKey: ["sweet-treats"],
    queryFn: () => getCakesForCategory(SWEET_TREATS_CATEGORY_ID),
    staleTime: 5 * 60_000,
  });
  const sweetTreats = SWEET_TREATS_ORDER.flatMap((slug) => sweetTreatsData.filter((t) => t.slug === slug && t.minPrice > 0));
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
  // Same tabbed rail as the Kids Cakes page, one tab per character.
  const characterTabCakes = useMemo<TabbedCake[]>(
    () =>
      characterGroups.flatMap((group) =>
        group.cakes.map((cake) => ({
          id: cake.id,
          href: cake.href,
          image: cake.image,
          title: cake.name,
          badge: cake.badge,
          minPrice: cake.minPrice,
          ...(cake.minPriceMrp != null && { minPriceMrp: cake.minPriceMrp }),
          deliveryEstimate: cake.deliveryEstimate,
          outOfStock: cake.outOfStock,
          tabGroup: group.character,
          enquiry: true,
        })),
      ),
    [characterGroups],
  );

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
                <HeroImage banner={banner} index={index} />
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
                <HeroImage banner={banner} index={index} />
              </Link>
            ),
          )}
          <AdminShortcut
            label="Change banners"
            search={{ tab: "banners" }}
            className="absolute right-3 top-3"
          />
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
          ].map(({ icon: Icon, top, bottom }, index) => (
            <div key={top} className="flex items-center gap-3 px-3 py-2 sm:justify-center">
              <Icon size={21} className="shrink-0 text-primary" />
              <span>
                <EditableText id={`home.trust.${index}.top`} as="strong" className="block text-sm">
                  {top}
                </EditableText>
                <EditableText id={`home.trust.${index}.bottom`} className="text-xs text-muted-foreground">
                  {bottom}
                </EditableText>
              </span>
            </div>
          ))}
        </div>

        <section className="pb-6 pt-9">
          <EditableText id="home.flavours.title" as="h2" className="font-display text-3xl">
            A flavour for every craving
          </EditableText>
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
                  <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-muted">
                    <EditableImage id={`flavour.${flavour.slug}.image`} fallback="" buttonPosition="left-1 top-1" compact>
                      {(uploaded) =>
                        uploaded ? (
                          <img
                            src={resizedImageUrl(uploaded, 256)}
                            alt={flavour.label}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 hover:scale-105"
                          />
                        ) : (
                          <FlavourThumbnail label={flavour.label} slug={flavour.slug} />
                        )
                      }
                    </EditableImage>
                  </span>
                  <EditableText
                    id={`flavour.${flavour.slug}.label`}
                    className="mt-2 block truncate text-xs font-semibold leading-4 sm:text-sm"
                  >
                    {flavour.label}
                  </EditableText>
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
          <EditableText id="home.celebrations.title" as="h2" className="font-display text-3xl">
            Cakes for every celebration
          </EditableText>
          <div className="relative mt-5">
            <div
              ref={celebrationScrollRef}
              className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-3"
            >
              {celebrations.map((occasion) => (
                <Link
                  key={occasion.label}
                  to="/category/$categorySlug"
                  params={{ categorySlug: occasion.category }}
                  className="group relative aspect-[2.15/1] w-[300px] shrink-0 snap-start overflow-hidden rounded-xl bg-[#f6e9da] shadow-sm sm:w-[380px]"
                >
                  <EditableImage
                    id={`home.celebrations.${occasion.category}.image`}
                    fallback={occasion.image}
                    buttonPosition="right-2 top-2"
                  >
                    {(image) => (
                      <>
                        {/* The photo, blurred, fills the whole tile as a backdrop in its own colours… */}
                        <img
                          src={resizedImageUrl(image, 48, 40)}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
                        />
                        <span aria-hidden="true" className="absolute inset-0 bg-white/45" />
                        {/* …and the sharp photo sits on the right, fading into it, so the cake isn't under the text. */}
                        <img
                          src={resizedImageUrl(image, 480)}
                          alt=""
                          loading="lazy"
                          className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[center_60%] transition duration-500 [mask-image:linear-gradient(to_right,transparent,black_35%)] group-hover:scale-105"
                        />
                      </>
                    )}
                  </EditableImage>
                  <div className="relative z-10 flex h-full max-w-[56%] flex-col p-4 sm:p-5">
                    <EditableText
                      id={`home.celebrations.${occasion.category}.label`}
                      as="h3"
                      className="text-lg font-extrabold leading-tight text-primary sm:text-xl"
                    >
                      {occasion.label}
                    </EditableText>
                    <EditableText
                      id={`home.celebrations.${occasion.category}.description`}
                      as="p"
                      className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-foreground/75 sm:text-xs"
                    >
                      {occasion.description}
                    </EditableText>
                    <span className="mt-auto inline-flex w-fit items-center gap-0.5 rounded-md bg-background px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                      Order Now
                      <ChevronRight size={12} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <button
              type="button"
              aria-label="Scroll celebrations left"
              onClick={() => scrollByCards(celebrationScrollRef, -1)}
              className="absolute left-0 top-1/2 hidden -translate-x-3 -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Scroll celebrations right"
              onClick={() => scrollByCards(celebrationScrollRef, 1)}
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-3 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <section className="border-t border-border py-9">
          <EditableText id="home.collection.title" as="h2" className="font-display text-3xl">
            The Celebration Collection
          </EditableText>
          <div className="relative mt-5">
            <div
              ref={collectionScrollRef}
              className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-6 sm:gap-6"
            >
              {COLLECTIONS.map((item) => (
                <Link
                  key={item.slug}
                  to="/collection/$slug"
                  params={{ slug: item.slug }}
                  className="group relative w-[42vw] max-w-[220px] shrink-0 snap-start sm:w-[200px] lg:w-[210px]"
                >
                  <span className="relative block aspect-[3/5] overflow-hidden rounded-md bg-muted shadow-sm">
                    <EditableImage id={`home.collection.${item.slug}.image`} fallback={item.image}>
                      {(image) => (
                        <img
                          src={resizedImageUrl(image, 480)}
                          alt={item.label}
                          width={480}
                          height={800}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      )}
                    </EditableImage>
                  </span>
                  {/* Gradient label pill overlapping the bottom edge of the photo. */}
                  <EditableText
                    id={`home.collection.${item.slug}.label`}
                    className="absolute inset-x-3 -bottom-3 rounded-lg bg-gradient-to-r from-[#f0566f] to-[#9b5cf6] px-2 py-2 text-center text-xs font-semibold text-white shadow-md sm:text-sm"
                  >
                    {item.label}
                  </EditableText>
                </Link>
              ))}
            </div>
            <button
              type="button"
              aria-label="Scroll collection left"
              onClick={() => scrollByCards(collectionScrollRef, -1)}
              className="absolute left-0 top-[45%] hidden -translate-x-3 -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Scroll collection right"
              onClick={() => scrollByCards(collectionScrollRef, 1)}
              className="absolute right-0 top-[45%] hidden -translate-y-1/2 translate-x-3 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        {sweetTreats.length > 0 && (
          <section className="border-t border-border py-9">
            <EditableText id="home.sweets.title" as="h2" className="font-display text-3xl">
              Sweet Treats & More
            </EditableText>
            <EditableText id="home.sweets.intro" as="p" className="mt-1 text-sm text-muted-foreground">
              Brownies, cookies, creamy desserts and donuts — little indulgences, big happiness.
            </EditableText>
            <div className="relative mt-5">
              <div
                ref={sweetsScrollRef}
                className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-6 sm:gap-6"
              >
                {sweetTreats.map((treat) => (
                  <Link
                    key={treat.id}
                    to="/product/$productSlug"
                    params={{ productSlug: treat.slug }}
                    className="group relative w-[42vw] max-w-[220px] shrink-0 snap-start sm:w-[200px] lg:w-[210px]"
                  >
                    <span className="relative block aspect-[3/5] overflow-hidden rounded-md bg-muted shadow-sm">
                      <EditableImage
                        fallback={treat.image}
                        onSave={(image_url) => saveProduct(treat.id, { image_url })}
                      >
                        {(image) => (
                          <img
                            {...responsiveImage(image, 240, "(min-width: 640px) 210px, 42vw")}
                            alt={treat.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        )}
                      </EditableImage>
                      <AdminShortcut
                        label="Price"
                        search={{ tab: "products", q: treat.name }}
                        className="absolute right-2 top-2"
                      />
                    </span>
                    <span className="absolute inset-x-3 -bottom-3 rounded-lg bg-gradient-to-r from-[#f0566f] to-[#9b5cf6] px-2 py-1.5 text-center text-white shadow-md">
                      <EditableText
                        className="block truncate text-xs font-semibold sm:text-sm"
                        onSave={(name) => saveProduct(treat.id, { name })}
                      >
                        {treat.name}
                      </EditableText>
                      <span className="block text-[11px] font-bold opacity-95">₹{treat.minPrice}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <button
                type="button"
                aria-label="Scroll sweet treats left"
                onClick={() => scrollByCards(sweetsScrollRef, -1)}
                className="absolute left-0 top-[45%] hidden -translate-x-3 -translate-y-1/2 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Scroll sweet treats right"
                onClick={() => scrollByCards(sweetsScrollRef, 1)}
                className="absolute right-0 top-[45%] hidden -translate-y-1/2 translate-x-3 rounded-full border border-border bg-background p-2 shadow-md transition hover:bg-accent sm:flex"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {characterTabCakes.length > 0 && (
          <section id="shop" className="scroll-mt-24 border-t border-border py-10">
            <EditableText id="home.characters.title" as="h2" className="font-display text-3xl">
              Character Cake
            </EditableText>
            <EditableText id="home.characters.intro" as="p" className="mt-1 text-sm text-muted-foreground">
              Pick a favourite character to see their cakes.
            </EditableText>

            <CakeTabsRail
              cakes={characterTabCakes}
              tabOrder={characterGroups.map((group) => group.character)}
              ariaLabel="Shop by character"
              icon={characterIcon}
            />
          </section>
        )}
      </div>

      <ReviewsSection />

      <SiteFooter />
    </main>
  );
}
