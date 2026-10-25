import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CakeSlice } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { Button } from "@/components/button";
import { getCollection } from "@/lib/collections";
import { productsBySlug, productsNamed } from "@/lib/search";
import { isEnquiryCategory } from "@/lib/enquiry";
import { EditableText } from "@/components/editable";

/** One "Celebration Collection" tile's page: its featured cake, then every matching cake. */
export const Route = createFileRoute("/collection/$slug")({
  loader: async ({ params }) => {
    const collection = getCollection(params.slug);
    if (!collection) throw notFound();
    const [featured, matches] = await Promise.all([
      productsBySlug(collection.featured),
      collection.words.length ? productsNamed(collection.words) : Promise.resolve([]),
    ]);
    // Featured first; drop repeats of the same cake (by slug or by name).
    const seen = new Set<string>();
    const cakes = [...featured, ...matches].filter((cake) => {
      const keys = [cake.slug, cake.name.trim().toLowerCase().replace(/\s+/g, " ")];
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    });
    return { collection, cakes };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.collection.title} | Cake Stories` },
          { name: "description", content: loaderData.collection.intro },
        ]
      : [],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const { collection, cakes } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav className="py-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">
            <EditableText id="breadcrumb.home">Home</EditableText>
          </Link>
          <span className="mx-1.5">/</span>
          <EditableText id="home.collection.title">The Celebration Collection</EditableText>
          <span className="mx-1.5">/</span>
          <EditableText id={`home.collection.${collection.slug}.label`} className="text-foreground">
            {collection.label}
          </EditableText>
        </nav>

        <div className="border-b border-border pb-6">
          <EditableText id={`collection.${collection.slug}.title`} as="h1" className="block font-display text-3xl sm:text-4xl">
            {collection.title}
          </EditableText>
          <p className="mt-1 text-sm text-muted-foreground">
            <EditableText id={`collection.${collection.slug}.intro`}>{collection.intro}</EditableText> {cakes.length}{" "}
            {cakes.length === 1 ? (
              <EditableText id="collection.cake">cake</EditableText>
            ) : (
              <EditableText id="collection.cakes">cakes</EditableText>
            )}
            .
          </p>
        </div>

        {cakes.length === 0 ? (
          <div className="my-16 text-center">
            <CakeSlice className="mx-auto text-muted-foreground" size={36} />
            <EditableText id="collection.empty.title" as="h2" className="mt-3 block font-display text-2xl">
              Coming soon
            </EditableText>
            <EditableText id="collection.empty.text" as="p" className="mt-1 block text-sm text-muted-foreground">
              We're putting this collection together.
            </EditableText>
            <Button className="mt-4" asChild>
              <Link to="/">
                <EditableText id="category.comingSoon.button">Browse our cakes</EditableText>
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mb-12 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cakes.map((cake) => (
              <CakeCard
                productId={cake.id}
                key={cake.id}
                href={cake.href}
                image={cake.image}
                title={cake.name}
                badge={cake.badge ?? null}
                minPrice={cake.minPrice}
                {...(cake.minPriceMrp != null && { minPriceMrp: cake.minPriceMrp })}
                deliveryEstimate={cake.deliveryEstimate ?? null}
                enquiry={isEnquiryCategory(cake.categorySlug)}
              />
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
