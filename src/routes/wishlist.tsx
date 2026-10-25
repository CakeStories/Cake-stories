import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { PriceTag } from "@/components/price-tag";
import { useWishlist } from "@/lib/wishlist";
import { isEnquiryHref } from "@/lib/enquiry";
import { DEFAULT_PRODUCT_IMAGE, onProductImageError } from "@/lib/image-fallback";
import { resizedImageUrl } from "@/lib/supabase";
import { EditableText } from "@/components/editable";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Your Wishlist | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { items, remove } = useWishlist();

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <SiteHeader hideCategories />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <EditableText id="wishlist.title" as="h1" className="block font-display text-3xl sm:text-4xl">Your Wishlist</EditableText>

        {items.length === 0 ? (
          <div className="my-16 text-center">
            <Heart className="mx-auto text-muted-foreground" size={36} />
            <EditableText id="wishlist.empty.title" as="h3" className="mt-3 block font-display text-2xl">Your wishlist is empty</EditableText>
            <EditableText id="wishlist.empty.text" as="p" className="mt-1 block text-sm text-muted-foreground">Tap "Add to Wishlist" on any cake to save it here for later.</EditableText>
            <Button className="mt-4" asChild>
              <Link to="/"><EditableText id="common.browseCakes">Browse cakes</EditableText></Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-md border border-border bg-card">
                <Link to={item.href} className="block aspect-square overflow-hidden bg-muted">
                  <img
                    src={resizedImageUrl(item.image || DEFAULT_PRODUCT_IMAGE, 400)}
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
                    {item.enquiry || isEnquiryHref(item.href) ? (
                      <EditableText id="card.enquire" as="span" className="text-xs font-semibold text-primary">Enquire for price</EditableText>
                    ) : (
                      <PriceTag price={item.price} mrp={item.mrp} size="sm" />
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" asChild>
                      <Link to={item.href}><EditableText id="wishlist.view">View</EditableText></Link>
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
