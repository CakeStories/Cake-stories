import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { firstSlugForFlavour } from "@/lib/flavour-families";

/**
 * "A flavour for every craving" tiles on the homepage link here. Each tile
 * represents a family of Birthday Cakes products from the printed menu
 * (e.g. "Black Forest" covers three separate designs) — this route just
 * resolves to the first product in that family and hands off to its own
 * page, where the Flavour selector lists the rest of the family.
 */
export const Route = createFileRoute("/flavour/$flavourSlug")({
  loader: ({ params }) => {
    const firstSlug = firstSlugForFlavour(params.flavourSlug);
    if (!firstSlug) throw notFound();
    throw redirect({ to: "/birthday-cake/$slug", params: { slug: firstSlug } });
  },
});
