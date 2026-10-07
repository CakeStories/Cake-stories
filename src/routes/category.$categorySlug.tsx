import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CakeSlice } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { Button } from "@/components/button";
import { getWeddingCakes } from "@/lib/wedding-cakes";
import { getBirthdayCakes } from "@/lib/birthday-cakes";
import { getKidsCakes } from "@/lib/kids-cakes";
import { getCategories, getCategoryBySlug, basePathForCategorySlug } from "@/lib/categories";
import { getCakesForCategory } from "@/lib/generic-cakes";
import { getCategoryBanners } from "@/lib/banners";
import { CategoryBanners } from "@/components/category-banners";
import { CustomizeWhatsAppBanner } from "@/components/customize-whatsapp-banner";
import { BirthdayBashCakeRow } from "@/components/birthday-bash-cake-row";
import { CakeTabsRail, type TabbedCake } from "@/components/cake-tabs-rail";
import { useStoreSettings } from "@/lib/store-settings";
import {
  CategoryFilterBar,
  DEFAULT_FILTERS,
  applyFilters,
  availableFlavours,
  availablePriceBands,
  type FilterState,
} from "@/components/category-filter-bar";

const SPECIAL_CAKE_SLUGS = new Set(["wedding-cakes", "birthday-cakes", "kids-cakes"]);

export const Route = createFileRoute("/category/$categorySlug")({
  loader: async ({ params }) => {
    const category = await getCategoryBySlug(params.categorySlug);
    if (!category) throw notFound();

    const isSpecial = SPECIAL_CAKE_SLUGS.has(category.slug);
    const weddingCakes = category.slug === "wedding-cakes" ? await getWeddingCakes() : [];
    const birthdayCakes = category.slug === "birthday-cakes" ? await getBirthdayCakes() : [];
    const kidsCakes = category.slug === "kids-cakes" ? await getKidsCakes() : [];

    // Every other category (Desserts, Christmas, and any new category the
    // shop owner creates) shows only real products managed from /manage —
    // no more hand-entered placeholder cakes mixed in.
    const [featuredCakes, allCategories] = isSpecial
      ? [[], []]
      : await Promise.all([getCakesForCategory(category.id), getCategories()]);

    const categoryBanners = await getCategoryBanners(category.id).catch(() => ({ top: [], bottom: [] }));

    return { category, weddingCakes, birthdayCakes, kidsCakes, featuredCakes, allCategories, categoryBanners };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.category.name} | Cake Stories` },
          { name: "description", content: `Order fresh ${loaderData.category.name} online. Handcrafted, baked fresh, same-day delivery from Cake Stories.` },
        ]
      : [],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { category, weddingCakes, birthdayCakes, kidsCakes, featuredCakes, allCategories, categoryBanners } = Route.useLoaderData();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  // Switching to another category starts with a clean slate.
  useEffect(() => setFilters(DEFAULT_FILTERS), [category.slug]);
  const settings = useStoreSettings();
  const isWeddingCakes = category.slug === "wedding-cakes";
  const isBirthdayCakes = category.slug === "birthday-cakes";
  const isKidsCakes = category.slug === "kids-cakes";
  const isBirthdayBash = category.slug === "birthday-bash";
  const isOtherCategory = !isWeddingCakes && !isBirthdayCakes && !isKidsCakes;

  const categorySlugById = useMemo(() => new Map(allCategories.map((c) => [c.id, c.slug])), [allCategories]);

  // Only cakes with a tab set (from /manage) feed the "Shop by Flavour" rail
  // at the top of the Birthday Cakes page — the regular grid below still
  // shows every birthday cake regardless of tab.
  const birthdayTabCakes = useMemo<TabbedCake[]>(
    () =>
      birthdayCakes
        .filter((cake) => cake.tabGroup)
        .map((cake) => ({
          id: cake.id,
          href: `/birthday-cake/${cake.slug}`,
          image: cake.image,
          title: cake.name,
          badge: cake.badge,
          minPrice: cake.minPrice,
          ...(cake.minPriceMrp != null && { minPriceMrp: cake.minPriceMrp }),
          deliveryEstimate: cake.deliveryEstimate,
          outOfStock: cake.outOfStock,
          tabGroup: cake.tabGroup,
        })),
    [birthdayCakes],
  );

  const byNameAsc = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  const sortedWeddingCakes = useMemo(
    () =>
      applyFilters(
        weddingCakes,
        filters,
        { name: (c) => c.name, price: (c) => c.minPrice, flavours: (c) => c.flavours },
        (a, b) => a.code.localeCompare(b.code),
      ),
    [weddingCakes, filters],
  );

  const sortedBirthdayCakes = useMemo(
    () => applyFilters(birthdayCakes, filters, { name: (c) => c.name, price: (c) => c.minPrice }, byNameAsc),
    [birthdayCakes, filters],
  );

  const sortedKidsCakes = useMemo(
    () =>
      applyFilters(
        kidsCakes,
        filters,
        { name: (c) => c.name, price: (c) => c.minPrice, flavours: (c) => c.flavours },
        byNameAsc,
      ),
    [kidsCakes, filters],
  );

  const sortedFeaturedCakes = useMemo(
    () =>
      applyFilters(
        featuredCakes,
        filters,
        { name: (c) => c.name, price: (c) => c.minPrice, flavours: (c) => c.flavours },
        byNameAsc,
      ),
    [featuredCakes, filters],
  );

  // Totals before any filter is applied, and the filter options that actually
  // apply to this category's cakes (no "Kiwi" chip on a page with no kiwi cake).
  const totalCount = isWeddingCakes
    ? weddingCakes.length
    : isBirthdayCakes
      ? birthdayCakes.length
      : isKidsCakes
        ? kidsCakes.length
        : featuredCakes.length;
  const shownCount = isWeddingCakes
    ? sortedWeddingCakes.length
    : isBirthdayCakes
      ? sortedBirthdayCakes.length
      : isKidsCakes
        ? sortedKidsCakes.length
        : sortedFeaturedCakes.length;

  const { flavourOptions, priceOptions } = useMemo(() => {
    const prices = { name: (c: { name: string }) => c.name, price: (c: { minPrice: number }) => c.minPrice };
    if (isWeddingCakes) {
      const acc = { ...prices, flavours: (c: (typeof weddingCakes)[number]) => c.flavours } as never;
      return { flavourOptions: availableFlavours(weddingCakes, acc), priceOptions: availablePriceBands(weddingCakes, acc) };
    }
    if (isBirthdayCakes) {
      const acc = prices as never;
      return { flavourOptions: availableFlavours(birthdayCakes, acc), priceOptions: availablePriceBands(birthdayCakes, acc) };
    }
    const list = isKidsCakes ? kidsCakes : featuredCakes;
    const acc = { ...prices, flavours: (c: (typeof kidsCakes)[number]) => c.flavours } as never;
    return { flavourOptions: availableFlavours(list, acc), priceOptions: availablePriceBands(list, acc) };
  }, [isWeddingCakes, isBirthdayCakes, isKidsCakes, weddingCakes, birthdayCakes, kidsCakes, featuredCakes]);

  const filterBar =
    totalCount > 1 ? (
      <CategoryFilterBar
        state={filters}
        onChange={setFilters}
        flavourOptions={flavourOptions}
        priceOptions={priceOptions}
        shown={shownCount}
        total={totalCount}
      />
    ) : null;

  const noMatches = (
    <div className="my-12 text-center">
      <CakeSlice className="mx-auto text-muted-foreground" size={32} />
      <h3 className="mt-3 font-display text-xl">No cakes match those filters</h3>
      <button
        type="button"
        onClick={() => setFilters({ ...filters, flavours: [], priceBand: null })}
        className="mt-2 text-sm font-medium text-primary underline"
      >
        Clear filters
      </button>
    </div>
  );

  const count = totalCount;

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader activeCategory={category.slug} />

      {category.bannerText && (
        <div className="bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
          {category.bannerText}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav className="py-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{category.name}</span>
        </nav>

        <CategoryBanners banners={categoryBanners.top} />

        {isBirthdayBash ? (
          <div className="pb-6 pt-2">
            <CustomizeWhatsAppBanner />
          </div>
        ) : (
          <div className="border-b border-border pb-6">
            <div className="min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl">{category.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {count} {isWeddingCakes || isKidsCakes ? "cake designs" : isBirthdayCakes ? "cakes" : "items"} in this category.
                {(isWeddingCakes || isKidsCakes) && " Pick a design to choose your flavour and size."}
                {isBirthdayCakes && " Pick a cake to choose your size."}
              </p>
            </div>
          </div>
        )}

        {isBirthdayBash ? (
          featuredCakes.length > 0 && sortedFeaturedCakes.length === 0 ? (
            <>
              <div className="mt-6">{filterBar}</div>
              {noMatches}
            </>
          ) : sortedFeaturedCakes.length > 0 ? (
            <div className="py-8">
              <div className="mb-8">{filterBar}</div>
              <div className="space-y-10">
              {sortedFeaturedCakes.map((cake) => (
                <BirthdayBashCakeRow key={cake.id} cake={cake} />
              ))}
              </div>
            </div>
          ) : (
            <div className="my-16 text-center">
              <CakeSlice className="mx-auto text-muted-foreground" size={36} />
              <h3 className="mt-3 font-display text-2xl">No cakes here yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Check back soon, or browse another category.</p>
              <Button className="mt-4" asChild>
                <Link to="/">See all cakes</Link>
              </Button>
            </div>
          )
        ) : isWeddingCakes ? (
          <>
          <div className="mt-6">{filterBar}</div>
          {sortedWeddingCakes.length === 0 && noMatches}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sortedWeddingCakes.map((cake) => (
              <CakeCard
                key={cake.slug}
                href={`/wedding-cake/${cake.slug}`}
                image={cake.image}
                title={cake.name}
                badge={cake.badge}
                minPrice={cake.minPrice}
                minPriceMrp={cake.minPriceMrp}
                deliveryEstimate={cake.deliveryEstimate}
                meta={`${cake.flavours.length} flavours · ${cake.sizes.join(" / ")}`}
                outOfStock={cake.outOfStock}
              />
            ))}
          </div>
          </>
        ) : isBirthdayCakes ? (
          <>
            {birthdayTabCakes.length > 0 && (
              <>
                <CakeTabsRail
                  title="Shop by Flavour"
                  cakes={birthdayTabCakes}
                  tabOrder={settings.birthdayTabs}
                />
              </>
            )}
            <div className={birthdayTabCakes.length > 0 ? "mt-8" : "mt-7"}>{filterBar}</div>
            {sortedBirthdayCakes.length === 0 && noMatches}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {sortedBirthdayCakes.map((cake) => (
                <CakeCard
                  key={cake.id}
                  href={`/birthday-cake/${cake.slug}`}
                  image={cake.image}
                  title={cake.name}
                  badge={cake.badge}
                  minPrice={cake.minPrice}
                  minPriceMrp={cake.minPriceMrp}
                  deliveryEstimate={cake.deliveryEstimate}
                  meta={cake.sizes.join(" / ")}
                  outOfStock={cake.outOfStock}
                />
              ))}
            </div>
          </>
        ) : isKidsCakes ? (
          <>
          <div className="mt-6">{filterBar}</div>
          {sortedKidsCakes.length === 0 && noMatches}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sortedKidsCakes.map((cake) => (
              <CakeCard
                key={cake.id}
                href={`/kids-cake/${cake.slug}`}
                image={cake.image}
                title={cake.name}
                badge={cake.badge}
                minPrice={cake.minPrice}
                minPriceMrp={cake.minPriceMrp}
                deliveryEstimate={cake.deliveryEstimate}
                meta={`${cake.flavours.length} flavours · ${cake.sizes.join(" / ")}`}
                outOfStock={cake.outOfStock}
              />
            ))}
          </div>
          </>
        ) : count > 0 ? (
          <>
          <div className="mt-6">{filterBar}</div>
          {sortedFeaturedCakes.length === 0 && noMatches}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sortedFeaturedCakes.map((cake) => {
              const primarySlug = categorySlugById.get(cake.categoryId);
              const basePath = primarySlug ? basePathForCategorySlug(primarySlug) : "/product";
              return (
                <CakeCard
                  key={cake.id}
                  href={`${basePath}/${cake.slug}`}
                  image={cake.image}
                  title={cake.name}
                  badge={cake.badge}
                  minPrice={cake.minPrice}
                  minPriceMrp={cake.minPriceMrp}
                  deliveryEstimate={cake.deliveryEstimate}
                  meta={cake.sizes.join(" / ")}
                  outOfStock={cake.outOfStock}
                />
              );
            })}
          </div>
          </>
        ) : (
          <div className="my-16 text-center">
            <CakeSlice className="mx-auto text-muted-foreground" size={36} />
            <h3 className="mt-3 font-display text-2xl">No cakes here yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon, or browse another category.</p>
            <Button className="mt-4" asChild>
              <Link to="/">See all cakes</Link>
            </Button>
          </div>
        )}

        <CategoryBanners banners={categoryBanners.bottom} />
      </div>

      <SiteFooter />
    </main>
  );
}
