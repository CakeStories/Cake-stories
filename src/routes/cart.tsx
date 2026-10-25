import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { useCart, type CartLine } from "@/lib/cart";
import { FREE_DELIVERY_THRESHOLD, deliveryFeeFor } from "@/lib/pricing";
import { DEFAULT_PRODUCT_IMAGE, onProductImageError } from "@/lib/image-fallback";
import { resizedImageUrl } from "@/lib/supabase";
import { EditableText } from "@/components/editable";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function LineLink({
  item,
  className,
  children,
}: {
  item: CartLine;
  className?: string;
  children: React.ReactNode;
}) {
  if (!item.href) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link to={item.href} className={className}>
      {children}
    </Link>
  );
}

function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const deliveryFee = deliveryFeeFor(subtotal, "delivery");
  const total = subtotal + deliveryFee;

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <EditableText id="cart.title" as="h1" className="block font-display text-3xl sm:text-4xl">Your Cart</EditableText>

        {items.length === 0 ? (
          <div className="my-16 text-center">
            <ShoppingBag className="mx-auto text-muted-foreground" size={36} />
            <EditableText id="cart.empty.title" as="h3" className="mt-3 block font-display text-2xl">Your cart is empty</EditableText>
            <EditableText id="cart.empty.text" as="p" className="mt-1 block text-sm text-muted-foreground">Add a cake to get started.</EditableText>
            <Button className="mt-4" asChild>
              <Link to="/"><EditableText id="common.browseCakes">Browse cakes</EditableText></Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <ul className="divide-y divide-border border-y border-border">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <LineLink
                    item={item}
                    className="block size-24 shrink-0 overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={resizedImageUrl(item.image || DEFAULT_PRODUCT_IMAGE, 200)}
                      alt={item.name}
                      onError={onProductImageError}
                      className="h-full w-full object-cover"
                    />
                  </LineLink>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <LineLink item={item} className="text-sm font-semibold hover:text-primary">
                        {item.name}
                      </LineLink>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground">{item.variant}</p>
                      )}
                      {item.note && (
                        <p className="text-xs italic text-muted-foreground">"{item.note}"</p>
                      )}
                      {item.specialInstructions && (
                        <p className="text-xs text-muted-foreground">
                          <EditableText id="cart.note">Note</EditableText>: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-input">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                          className="grid size-8 place-items-center hover:bg-muted"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => setQuantity(item.id, Math.min(50, item.quantity + 1))}
                          className="grid size-8 place-items-center hover:bg-muted"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <strong className="text-sm">₹{item.price * item.quantity}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from cart`}
                    onClick={() => removeItem(item.id)}
                    className="self-start text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={17} />
                  </button>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-md border border-border p-5">
              <EditableText id="cart.summary" as="h2" className="block font-display text-xl">Order Summary</EditableText>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><EditableText id="cart.subtotal">Subtotal</EditableText></dt>
                  <dd>₹{subtotal}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><EditableText id="cart.delivery">Delivery</EditableText></dt>
                  <dd>{deliveryFee === 0 ? <EditableText id="cart.free">Free</EditableText> : `₹${deliveryFee}`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><EditableText id="cart.gst">GST (5% cakes, 18% party items)</EditableText></dt>
                  <dd className="text-muted-foreground"><EditableText id="cart.atCheckout">At checkout</EditableText></dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt><EditableText id="cart.totalBeforeGst">Total before GST</EditableText></dt>
                  <dd>₹{total}</dd>
                </div>
              </dl>
              {subtotal < FREE_DELIVERY_THRESHOLD && (
                <p className="mt-3 text-xs text-muted-foreground">
                  <EditableText id="cart.addMore">Add</EditableText> ₹{FREE_DELIVERY_THRESHOLD - subtotal}{" "}
                  <EditableText id="cart.moreForFree">more for free delivery. Store pickup is always free.</EditableText>
                </p>
              )}
              <Button size="lg" className="mt-5 w-full" asChild>
                <Link to="/checkout"><EditableText id="cart.checkout">Proceed to Checkout</EditableText></Link>
              </Button>
            </aside>
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
