import { Link } from "@tanstack/react-router";
import { Clock3, Sparkles } from "lucide-react";
import { PriceTag } from "@/components/price-tag";
import { useStoreSettings, withSitewideDiscount } from "@/lib/store-settings";
import { onProductImageError } from "@/lib/image-fallback";

export function CakeCard({
  href,
  image,
  title,
  badge,
  minPrice,
  minPriceMrp,
  deliveryEstimate: deliveryEstimateOverride,
  meta: _meta,
  fit = "cover",
  outOfStock = false,
}: {
  href: string;
  image: string;
  title: string;
  badge?: string | null;
  minPrice: number;
  minPriceMrp?: number;
  /**
   * This cake's own delivery-time estimate, set per-product in /manage.
   * When not set (or blank), falls back to the sitewide birthday/default
   * estimate from Store Settings, chosen by whether `href` is a birthday cake.
   */
  deliveryEstimate?: string | null;
  /**
   * Deprecated — flavour/size copy used to show here as a subtitle. The
   * thumbnail no longer displays it (kept so existing call sites don't need
   * to change), it's just ignored.
   */
  meta?: string;
  /**
   * "cover" (default) fills the square thumbnail and crops the edges — used
   * for every category grid card. "contain" shows the whole image with no
   * cropping — used on the full product page's main photo instead.
   */
  fit?: "cover" | "contain";
  outOfStock?: boolean;
}) {
  // Show the same sale price the product page and checkout use.
  const settings = useStoreSettings();
  const shown = withSitewideDiscount(minPrice, minPriceMrp, settings);
  const isBirthday = href.includes("/birthday-cake/");
  const deliveryEstimate =
    deliveryEstimateOverride ||
    (isBirthday ? settings.birthdayDeliveryEstimate : settings.defaultDeliveryEstimate);

  return (
    <Link to={href} className="group block overflow-hidden rounded-md border border-border bg-card">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={image}
          alt={title}
          loading="lazy"
          onError={onProductImageError}
          className={`h-full w-full transition duration-500 group-hover:scale-105 ${fit === "contain" ? "object-contain" : "object-cover"} ${outOfStock ? "opacity-60 grayscale" : ""}`}
        />
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold uppercase text-background">
            Out of Stock
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="min-h-10 text-sm font-semibold leading-5 group-hover:text-primary">
          {title}
        </h3>
        {!outOfStock && badge && (
          <span className="mt-1 inline-flex animate-pulse items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
            <Sparkles size={10} />
            {badge}
          </span>
        )}
        <p className="mt-1">
          <PriceTag price={shown.price} mrp={shown.mrp ?? null} size="sm" />
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-success">
          <Clock3 size={12} />
          {deliveryEstimate}
        </p>
      </div>
    </Link>
  );
}
