import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { CakePurchasePanel } from "@/components/cake-purchase-panel";
import { getCategory, getProduct, getProductsByCategory } from "@/lib/catalog";
import { getCategories, basePathForCategorySlug } from "@/lib/categories";
import { getCakeBySlugAnywhere, getCakesForCategory } from "@/lib/generic-cakes";
import { getPartyEssentials } from "@/lib/party-essentials";
import { onProductImageError } from "@/lib/image-fallback";

export const Route = createFileRoute("/product/$productSlug")({
  loader: async ({ params }) => {
    // Try the hand-entered catalogue first (Desserts, Party Essentials, etc.)
    const product = getProduct(params.productSlug);
    if (product) {
      const category = getCategory(product.category);
      const related = getProductsByCategory(product.category)
        .filter((p) => p.id !== product.id)
        .slice(0, 5);
      const partyEssentials = await getPartyEssentials(product.slug);
      return { kind: "catalog" as const, product, category, related, partyEssentials };
    }

    // Otherwise this may be a product the shop owner added themselves from
    // /manage, under any category (including a brand new one) — look it up
    // directly in Supabase instead.
    const cake = await getCakeBySlugAnywhere(params.productSlug);
    if (!cake) throw notFound();

    const allCategories = await getCategories();
    const category = allCategories.find((c) => c.id === cake.categoryId);
    const siblings = await getCakesForCategory(cake.categoryId);
    const related = siblings.filter((c) => c.id !== cake.id).slice(0, 5);
    const partyEssentials = await getPartyEssentials(cake.slug);
    return { kind: "generic" as const, cake, category, related, partyEssentials };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const title = loaderData.kind === "catalog" ? loaderData.product.name : loaderData.cake.name;
    const description =
      loaderData.kind === "catalog" ? loaderData.product.description : loaderData.cake.description;
    return {
      meta: [
        { title: `${title} | Cake Stories` },
        { name: "description", content: description ?? "" },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const data = Route.useLoaderData();
  const isCatalog = data.kind === "catalog";

  const title = isCatalog ? data.product.name : data.cake.name;
  const badge = isCatalog ? data.product.badge : data.cake.badge;
  const description = isCatalog ? data.product.description : data.cake.description;
  const image = isCatalog ? data.product.image : data.cake.image;
  const slug = isCatalog ? data.product.slug : data.cake.slug;
  const categoryName = isCatalog ? data.category?.label : data.category?.name;
  const categorySlug = isCatalog ? data.category?.slug : data.category?.slug;

  const related = isCatalog
    ? data.related.map((item) => ({
        id: item.id,
        href: `/product/${item.slug}`,
        image: item.image,
        title: item.name,
        badge: item.badge,
        minPrice: item.price,
        minPriceMrp: item.mrp,
        deliveryEstimate: null,
        meta: item.weight,
        outOfStock: false,
      }))
    : data.related.map((item) => ({
        id: item.id,
        href: `${categorySlug ? basePathForCategorySlug(categorySlug) : "/product"}/${item.slug}`,
        image: item.image,
        title: item.name,
        badge: item.badge,
        minPrice: item.minPrice,
        minPriceMrp: item.minPriceMrp,
        deliveryEstimate: item.deliveryEstimate,
        meta: item.sizes.join(" / "),
        outOfStock: item.outOfStock,
      }));

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader activeCategory={categorySlug} />

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav className="py-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          {categoryName && categorySlug && (
            <>
              <Link
                to="/category/$categorySlug"
                params={{ categorySlug }}
                className="hover:text-primary"
              >
                {categoryName}
              </Link>
              <span className="mx-1.5">/</span>
            </>
          )}
          <span className="text-foreground">{title}</span>
        </nav>

        <div className="grid grid-cols-1 items-stretch gap-8 border-b border-border pb-10 sm:grid-cols-2">
          {/* A plain in-flow square image: iOS Safari collapsed the old aspect-ratio box (holding only an absolutely positioned image) to 0x0. */}
          <div className="overflow-hidden rounded-lg bg-muted sm:sticky sm:top-24 sm:self-start">
            <img
              src={image}
              alt={title}
              onError={onProductImageError}
              className={`block aspect-square w-full object-cover ${categorySlug === "birthday-bash" ? "" : "sm:object-contain"}`}
              width={816}
              height={816}
            />
          </div>

          {isCatalog ? (
            <CakePurchasePanel
              key={slug}
              slug={slug}
              basePath="/product"
              title={title}
              badge={badge}
              description={description}
              image={image}
              flavours={[]}
              sizes={[data.product.weight]}
              getPrice={() => ({
                price: data.product.price,
                mrp: data.product.mrp,
                ref: { type: "catalog", slug: data.product.slug },
              })}
              outOfStock={false}
              partyEssentials={data.partyEssentials}
            />
          ) : (
            <CakePurchasePanel
              key={slug}
              slug={slug}
              basePath="/product"
              title={title}
              badge={badge}
              description={description}
              image={image}
              flavours={data.cake.flavours}
              sizes={data.cake.sizes}
              getPrice={(flavour, size) => {
                const v = data.cake.variants.find(
                  (v) =>
                    (data.cake.flavours.length > 0 ? v.flavour === flavour : true) &&
                    // Some products (e.g. Anniversary, Character cakes) have a single
                    // variant with no size — without this they could never be added to the cart.
                    (data.cake.sizes.length > 0 ? v.size === size : true),
                );
                return (
                  v && { price: v.price, mrp: v.mrp, ref: { type: "variant", variantId: v.id } }
                );
              }}
              outOfStock={data.cake.outOfStock}
              partyEssentials={data.partyEssentials}
            />
          )}
        </div>

        {related.length > 0 && (
          <section className="py-10">
            <h2 className="font-display text-2xl">More from {categoryName}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {related.map((item) => (
                <CakeCard
                  key={item.id}
                  href={item.href}
                  image={item.image}
                  title={item.title}
                  badge={item.badge}
                  minPrice={item.minPrice}
                  minPriceMrp={item.minPriceMrp}
                  deliveryEstimate={item.deliveryEstimate}
                  meta={item.meta}
                  outOfStock={item.outOfStock}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
