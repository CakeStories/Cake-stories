import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { PriceTag } from "@/components/price-tag";
import { useWishlist } from "@/lib/wishlist";
import { DEFAULT_PRODUCT_IMAGE, onProductImageError } from "@/lib/image-fallback";
import { proxiedImageUrl } from "@/lib/supabase";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Your Wishlist | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { items, remove } = useWishlist();

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <h1 className="font-display text-3xl sm:text-4xl">Your Wishlist</h1>

        {items.length === 0 ? (
          <div className="my-16 text-center">
            <Heart className="mx-auto text-muted-foreground" size={36} />
            <h3 className="mt-3 font-display text-2xl">Your wishlist is empty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap "Add to Wishlist" on any cake to save it here for later.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/">Browse cakes</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-md border border-border bg-card">
                <Link to={item.href} className="block aspect-square overflow-hidden bg-muted">
                  <img
                    src={proxiedImageUrl(item.image || DEFAULT_PRODUCT_IMAGE)}
                    alt={item.name}
                    onError={onProductImageError}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="p-3">
                  <Link to={item.href} className="text-sm font-semibold leading-5 hover:text-primary">
                    {item.name}
                  </Link>
                  <div className="mt-1">
                    <PriceTag price={item.price} mrp={item.mrp} size="sm" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" asChild>
                      <Link to={item.href}>View</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${item.name} from wishlist`}
                      onClick={() => remove(item.id)}
                    >
                      <Heart size={15} className="fill-current text-primary" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
