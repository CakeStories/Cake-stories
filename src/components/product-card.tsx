import { Link } from "@tanstack/react-router";
import { Clock3, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/button";
import { PriceTag } from "@/components/price-tag";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useStoreSettings, withSitewideDiscount } from "@/lib/store-settings";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const wishlist = useWishlist();
  const settings = useStoreSettings();
  const { price, mrp } = withSitewideDiscount(product.price, product.mrp, settings);
  const href = `/product/${product.slug}`;
  const deliveryEstimate =
    product.category === "birthday-cakes"
      ? settings.birthdayDeliveryEstimate
      : settings.defaultDeliveryEstimate;
  // Same id the product page uses, so the heart here and there stay in sync.
  const favorite = wishlist.has(href);

  return (
    <article className="group animate-rise min-w-0 overflow-hidden rounded-md border border-border bg-card">
      <Link
        to="/product/$productSlug"
        params={{ productSlug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={product.image}
          width={816}
          height={816}
          loading="lazy"
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-2 top-2 size-8 rounded-full"
          aria-label={
            favorite ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
          }
          aria-pressed={favorite}
          onClick={(event) => {
            event.preventDefault();
            wishlist.toggle({
              id: href,
              name: product.name,
              image: product.image,
              price,
              ...(mrp != null && { mrp }),
              href,
            });
          }}
        >
          <Heart
            size={15}
            fill={favorite ? "currentColor" : "none"}
            className={favorite ? "text-primary" : ""}
          />
        </Button>
      </Link>
      <div className="p-3">
        <Link to="/product/$productSlug" params={{ productSlug: product.slug }}>
          <h3 className="min-h-10 text-sm font-semibold leading-5 hover:text-primary">
            {product.name}
          </h3>
        </Link>
        {product.badge && (
          <span className="mt-1 inline-flex animate-pulse items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
            <Sparkles size={10} />
            {product.badge}
          </span>
        )}
        <div className="mt-1">
          <PriceTag price={price} mrp={mrp ?? null} />
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-success">
          <Clock3 size={12} />
          {deliveryEstimate}
        </p>
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={() =>
            addItem({
              ref: { type: "catalog", slug: product.slug },
              name: product.name,
              image: product.image,
              price,
              variant: product.weight,
              href,
            })
          }
        >
          Add to Cart
        </Button>
      </div>
    </article>
  );
}
