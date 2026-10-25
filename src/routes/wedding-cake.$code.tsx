import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EditableImage, EditableText } from "@/components/editable";
import { useEditMode } from "@/lib/edit-mode";
import { CakeCard } from "@/components/cake-card";
import { CakePurchasePanel } from "@/components/cake-purchase-panel";
import { getWeddingCakes } from "@/lib/wedding-cakes";
import { getPartyEssentials } from "@/lib/party-essentials";
import { onProductImageError } from "@/lib/image-fallback";
import { responsiveImage } from "@/lib/supabase";

export const Route = createFileRoute("/wedding-cake/$code")({
  loader: async ({ params }) => {
    // Independent of the cake lookup — start it straight away.
    const partyEssentialsPromise = getPartyEssentials(params.code).catch(() => []);
    const cakes = await getWeddingCakes();
    const cake = cakes.find((c) => c.slug === params.code);
    if (!cake) throw notFound();
    const related = cakes.filter((c) => c.slug !== cake.slug).slice(0, 5);
    const partyEssentials = await partyEssentialsPromise;
    return { cake, related, partyEssentials };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.cake.name} Wedding Cake | Cake Stories` },
          {
            name: "description",
            content: `Configure the ${loaderData.cake.name} wedding cake — choose your flavour and size, then enquire on WhatsApp.`,
          },
        ]
      : [],
  }),
  component: WeddingCakePage,
});

function WeddingCakePage() {
  const { cake, related, partyEssentials } = Route.useLoaderData();
  const { saveProduct } = useEditMode();

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader activeCategory="wedding-cakes" />

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav className="py-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">
            <EditableText id="breadcrumb.home">Home</EditableText>
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            to="/category/$categorySlug"
            params={{ categorySlug: "wedding-cakes" }}
            className="hover:text-primary"
          >
            <EditableText id="breadcrumb.wedding-cakes">Wedding Cakes</EditableText>
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{cake.name}</span>
        </nav>

        <div className="grid grid-cols-1 items-stretch gap-8 border-b border-border pb-10 sm:grid-cols-2">
          {/* A plain in-flow square image: iOS Safari collapsed the old aspect-ratio box (holding only an absolutely positioned image) to 0x0. */}
          <div className="relative overflow-hidden rounded-lg bg-muted sm:sticky sm:top-24 sm:self-start">
            <EditableImage
              fallback={cake.image}
              buttonPosition="left-3 top-3"
              onSave={(image_url) => saveProduct(cake.productId, { image_url })}
            >
              {(src) => (
                <img
                  {...responsiveImage(src, 640, "(min-width: 640px) 50vw, 100vw")}
                  fetchPriority="high"
                  alt={`${cake.name} wedding cake`}
                  onError={onProductImageError}
                  className="block aspect-square w-full object-cover sm:object-contain"
                />
              )}
            </EditableImage>
          </div>

          <CakePurchasePanel
            key={cake.slug}
            productId={cake.productId}
            slug={cake.slug}
            basePath="/wedding-cake"
            title={cake.name}
            description={
              cake.description ??
              `${cake.flavours.length} flavours available · custom name toppers and design tweaks available — chat with us after ordering.`
            }
            image={cake.image}
            flavours={cake.flavours}
            sizes={cake.sizes}
            getPrice={(flavour, size) => {
              const v = cake.variants.find((v) => v.flavour === flavour && v.size === size);
              return v && { price: v.price, mrp: v.mrp, ref: { type: "variant", variantId: v.id } };
            }}
            outOfStock={cake.outOfStock}
            enquiry
            partyEssentials={partyEssentials}
          />
        </div>

        {related.length > 0 && (
          <section className="py-10">
            <EditableText id="related.wedding-cakes" as="h2" className="font-display text-2xl">
              More Wedding Cakes
            </EditableText>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {related.map((item) => (
                <CakeCard
                  productId={item.productId}
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
                  enquiry
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
