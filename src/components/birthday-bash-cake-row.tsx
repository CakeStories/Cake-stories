import { useMemo, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { PriceTag } from "@/components/price-tag";
import { flavourLabel } from "@/lib/flavours";
import { cakeEnquiryLink } from "@/lib/whatsapp";
import { useStoreSettings, withSitewideDiscount } from "@/lib/store-settings";
import { onProductImageError } from "@/lib/image-fallback";
import type { GenericCake } from "@/lib/generic-cakes";

/**
 * One Birthday Bash cake, shown in full rather than linking to its own page —
 * these are fully custom designs, so instead of Add to Cart there's a
 * WhatsApp "Enquire Now" that carries over whatever flavour/size was picked
 * (or nothing, if the customer just wants to ask).
 */
export function BirthdayBashCakeRow({ cake }: { cake: GenericCake }) {
  const [flavour, setFlavour] = useState<string | undefined>(undefined);
  const [size, setSize] = useState<string | undefined>(undefined);
  const settings = useStoreSettings();

  const matchedVariant = useMemo(
    () =>
      cake.variants.find(
        (v) =>
          (cake.flavours.length === 0 || v.flavour === flavour) &&
          (cake.sizes.length === 0 || v.size === size),
      ),
    [cake, flavour, size],
  );

  const shown = matchedVariant
    ? withSitewideDiscount(matchedVariant.price, matchedVariant.mrp, settings)
    : withSitewideDiscount(cake.minPrice, cake.minPriceMrp, settings);

  const enquireHref = cakeEnquiryLink(
    cake.name,
    cake.flavours.length > 0 ? flavour : undefined,
    cake.sizes.length > 0 ? size : undefined,
  );

  // This one cake's photo already fits a plain square nicely — stretching it
  // like the others letterboxes it the other way round, so it keeps the
  // original square/contain treatment instead.
  const keepSquareImage = cake.slug === "blue-purple-character-bash";

  return (
    <article className="grid items-stretch gap-6 border-b border-border pb-10 last:border-b-0 sm:grid-cols-2 sm:gap-10">
      <div
        className={`relative aspect-square overflow-hidden rounded-lg bg-muted ${keepSquareImage ? "" : "sm:aspect-auto sm:h-full"}`}
      >
        <img
          src={cake.image}
          alt={cake.name}
          onError={onProductImageError}
          className={keepSquareImage ? "h-full w-full object-contain" : "absolute inset-0 h-full w-full object-contain"}
        />
        {cake.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-secondary-foreground">
            {cake.badge}
          </span>
        )}
      </div>

      <div className="flex flex-col justify-center">
        <h2 className="font-display text-2xl sm:text-3xl">{cake.name}</h2>

        <div className="mt-2">
          <PriceTag price={shown.price} mrp={shown.mrp ?? null} size="lg" />
        </div>

        {cake.description && (
          <p className="mt-3 text-sm leading-6 text-foreground/80">{cake.description}</p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {cake.flavours.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Flavour</span>
              <span className="relative block">
                <select
                  value={flavour ?? ""}
                  onChange={(e) => setFlavour(e.target.value || undefined)}
                  className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a flavour</option>
                  {cake.flavours.map((f) => (
                    <option key={f} value={f}>
                      {flavourLabel(f)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </span>
            </label>
          )}

          {cake.sizes.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Size</span>
              <span className="relative block">
                <select
                  value={size ?? ""}
                  onChange={(e) => setSize(e.target.value || undefined)}
                  className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a size</option>
                  {cake.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </span>
            </label>
          )}
        </div>

        <a
          href={enquireHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          <MessageCircle size={17} /> Enquire Now
        </a>
      </div>
    </article>
  );
}
