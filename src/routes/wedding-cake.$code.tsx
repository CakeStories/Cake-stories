import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { CakePurchasePanel } from "@/components/cake-purchase-panel";
import { getWeddingCakes } from "@/lib/wedding-cakes";
import { getPartyEssentials } from "@/lib/party-essentials";
import { onProductImageError } from "@/lib/image-fallback";

export const Route = createFileRoute("/wedding-cake/$code")({
  loader: async ({ params }) => {
    const cakes = await getWeddingCakes();
    const cake = cakes.find((c) => c.slug === params.code);
    if (!cake) throw notFound();
    const related = cakes.filter((c) => c.slug !== cake.slug).slice(0, 5);
    const partyEssentials = await getPartyEssentials(cake.slug);
    return { cake, related, partyEssentials };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.cake.name} Wedding Cake | Cake Stories` },
          {
            name: "description",
            content: `Configure the ${loaderData.cake.name} wedding cake — choose your flavour and size, from ₹${loaderData.cake.minPrice}.`,
          },
        ]
      : [],
  }),
  component: WeddingCakePage,
});

function WeddingCakePage() {
  const { cake, related, partyEssentials } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader activeCategory="wedding-cakes" />

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav className="py-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            to="/category/$categorySlug"
            params={{ categorySlug: "wedding-cakes" }}
            className="hover:text-primary"
          >
            Wedding Cakes
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{cake.name}</span>
        </nav>

        <div className="grid grid-cols-1 items-stretch gap-8 border-b border-border pb-10 sm:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted sm:aspect-auto sm:h-full">
            <img
              src={cake.image}
              alt={`${cake.name} wedding cake`}
              onError={onProductImageError}
              className="absolute inset-0 h-full w-full object-cover sm:object-contain"
            />
          </div>

          <CakePurchasePanel
            key={cake.slug}
            slug={cake.slug}
            basePath="/wedding-cake"
            title={cake.name}
            description={`${cake.flavours.length} flavours available · custom name toppers and design tweaks available — chat with us after ordering.`}
            image={cake.image}
            flavours={cake.flavours}
            sizes={cake.sizes}
            getPrice={(flavour, size) => {
              const v = cake.variants.find((v) => v.flavour === flavour && v.size === size);
              return v && { price: v.price, mrp: v.mrp, ref: { type: "variant", variantId: v.id } };
            }}
            outOfStock={cake.outOfStock}
            partyEssentials={partyEssentials}
          />
        </div>

        {related.length > 0 && (
          <section className="py-10">
            <h2 className="font-display text-2xl">More Wedding Cakes</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {related.map((item) => (
                <CakeCard
                  key={item.slug}
                  href={`/wedding-cake/${item.slug}`}
                  image={item.image}
                  title={item.name}
                  badge={item.badge}
                  minPrice={item.minPrice}
                  minPriceMrp={item.minPriceMrp}
                  deliveryEstimate={item.deliveryEstimate}
                  meta={`${item.flavours.length} flavours · ${item.sizes.join(" / ")}`}
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
