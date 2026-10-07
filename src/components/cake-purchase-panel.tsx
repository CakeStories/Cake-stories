import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/button";
import { PriceTag } from "@/components/price-tag";
import { flavourLabel } from "@/lib/flavours";
import { cartLineId, useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useStoreSettings, withSitewideDiscount } from "@/lib/store-settings";
import { CAKE_MESSAGE_MAX, INSTRUCTIONS_MAX, type CartItemRef } from "@/lib/pricing";
import type { PartyEssentialItem } from "@/lib/party-essentials";

export function CakePurchasePanel({
  slug,
  basePath,
  title,
  badge,
  description,
  image,
  flavours,
  sizes,
  getPrice,
  familyOptions,
  onFamilySelect,
  outOfStock = false,
  partyEssentials,
}: {
  slug: string;
  /** Route prefix used to build the cart line's href, e.g. "/birthday-cake", "/wedding-cake", "/kids-cake". */
  basePath: string;
  title: string;
  badge?: string | null;
  description?: string | null;
  image: string;
  /** Empty when this cake has no separate flavour choice (its name already implies the flavour). */
  flavours: string[];
  sizes: string[];
  /** The chosen option's price plus its cart reference (which the server re-prices at checkout). */
  getPrice: (
    flavour: string | undefined,
    size: string,
  ) => { price: number; mrp?: number | undefined; ref: CartItemRef } | undefined;
  /**
   * When this product is one of several designs in the same "flavour family"
   * (e.g. the three Black Forest cakes), pass the sibling products here.
   * Picking one navigates to that product's own page — its own image,
   * price and sizes — instead of changing a variant on this page. When
   * provided (with more than one option), this replaces the plain
   * same-product `flavours` selector above.
   */
  familyOptions?: { slug: string; label: string }[];
  onFamilySelect?: (slug: string) => void;
  /** Set by the shop owner in /manage when this cake can't be ordered right now. */
  outOfStock?: boolean;
  /** Party Essentials products shown in the "Make it special" strip above Add to Cart. */
  partyEssentials?: PartyEssentialItem[];
}) {
  const { items: cartItems, addItem, setItem, setQuantity: setCartQuantity } = useCart();
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const settings = useStoreSettings();

  // Wedding and Kids cakes need at least 24 hours' notice — see the checkout
  // page and lib/pricing.ts for the actual cutoff/date math.
  const needsAdvanceNotice = basePath === "/wedding-cake" || basePath === "/kids-cake";

  const showFamilySelector = Boolean(familyOptions && familyOptions.length > 1 && onFamilySelect);
  const showVariantFlavourSelector = !showFamilySelector && flavours.length > 1;

  const [flavour, setFlavour] = useState(flavours[0]);
  const [size, setSize] = useState(sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [added, setAdded] = useState(false);

  const rawVariant = getPrice(flavours.length > 0 ? flavour : undefined, size);
  const effective = rawVariant
    ? withSitewideDiscount(rawVariant.price, rawVariant.mrp, settings)
    : undefined;
  const price = effective?.price;

  const variantLabel = useMemo(() => {
    if (flavours.length > 0) return `${size} · ${flavourLabel(flavour ?? "")}`;
    return size;
  }, [flavours.length, size, flavour]);

  const buildLine = () => {
    if (price === undefined || !rawVariant) return null;
    const trimmedNote = note.trim();
    const trimmedInstructions = specialInstructions.trim();
    return {
      ref: rawVariant.ref,
      name: title,
      image,
      price,
      variant: variantLabel,
      href: `${basePath}/${slug}`,
      ...(trimmedNote && { note: trimmedNote }),
      ...(trimmedInstructions && { specialInstructions: trimmedInstructions }),
    };
  };

  const handleAdd = () => {
    const line = buildLine();
    if (!line) return;
    addItem(line, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  // "Make it special" strip — each item adds straight to the cart via its
  // own +/- stepper, without leaving this page.
  const partyEssentialLine = (item: PartyEssentialItem) =>
    item.variantId
      ? {
          ref: { type: "variant" as const, variantId: item.variantId },
          name: item.name,
          image: item.image,
          price: item.price,
          href: `/product/${item.slug}`,
        }
      : null;
  const partyEssentialQuantity = (item: PartyEssentialItem) => {
    const line = partyEssentialLine(item);
    if (!line) return 0;
    return cartItems.find((i) => i.id === cartLineId(line))?.quantity ?? 0;
  };
  const addPartyEssential = (item: PartyEssentialItem) => {
    const line = partyEssentialLine(item);
    if (!line) return;
    addItem(line);
  };
  const removePartyEssential = (item: PartyEssentialItem) => {
    const line = partyEssentialLine(item);
    if (!line) return;
    const qty = partyEssentialQuantity(item);
    setCartQuantity(cartLineId(line), qty - 1);
  };

  // "Buy Now" sets this exact line to the chosen quantity rather than adding
  // to it, so clicking Add to Cart first and then Buy Now doesn't double it.
  const handleBuyNow = () => {
    const line = buildLine();
    if (!line) return;
    setItem(line, quantity);
    void navigate({ to: "/checkout" });
  };

  const wishlistId = `${basePath}/${slug}`;
  const inWishlist = wishlist.has(wishlistId);

  const toggleWishlist = () => {
    wishlist.toggle({
      id: wishlistId,
      name: title,
      image,
      price: price ?? rawVariant?.price ?? 0,
      ...(effective?.mrp != null && { mrp: effective.mrp }),
      href: wishlistId,
    });
  };

  return (
    <div>
      {outOfStock ? (
        <span className="mb-3 inline-block rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase text-destructive-foreground">
          Out of Stock
        </span>
      ) : (
        badge && (
          <span className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-secondary-foreground">
            {badge}
          </span>
        )
      )}
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>

      <div className="mt-3">
        {price !== undefined ? (
          <PriceTag price={price} mrp={effective?.mrp ?? null} size="lg" />
        ) : (
          <strong className="text-2xl">Select options</strong>
        )}
      </div>

      {description && <p className="mt-4 text-sm leading-6 text-foreground/80">{description}</p>}

      {showFamilySelector && (
        <label className="mt-6 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Flavour</span>
          <span className="relative block">
            <select
              value={slug}
              onChange={(e) => onFamilySelect?.(e.target.value)}
              className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {familyOptions!.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
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

      {showVariantFlavourSelector && (
        <label className="mt-6 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Flavour</span>
          <span className="relative block">
            <select
              value={flavour}
              onChange={(e) => setFlavour(e.target.value)}
              className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {flavours.map((f) => (
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

      {sizes.length > 1 ? (
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Size</span>
          <span className="relative block">
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {sizes.map((s) => (
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
      ) : (
        sizes[0] && <p className="mt-4 text-sm text-muted-foreground">Size: {sizes[0]}</p>
      )}

      <div className="mt-5 flex items-center gap-3 text-xs font-medium text-success">
        <Clock3 size={14} />
        {needsAdvanceNotice ? "Minimum 24 hours' notice for delivery" : "Same-day delivery available"}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <ShieldCheck size={14} className="text-primary" /> Freshly baked after you order
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <Truck size={14} className="text-primary" /> Free delivery above ₹999
      </div>

      <label className="mt-6 block text-sm">
        <span className="mb-1 block font-medium text-foreground">
          Message on the cake (optional)
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, CAKE_MESSAGE_MAX))}
          placeholder="e.g. Happy Birthday Priya!"
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        <span className="mt-1 block text-right text-[11px] text-muted-foreground">
          {note.length}/{CAKE_MESSAGE_MAX}
        </span>
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-foreground">
          Special instructions (optional)
        </span>
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value.slice(0, INSTRUCTIONS_MAX))}
          placeholder="e.g. Please call before delivery, egg-free preferred, leave at the gate…"
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        <span className="mt-1 block text-right text-[11px] text-muted-foreground">
          {specialInstructions.length}/{INSTRUCTIONS_MAX}
        </span>
      </label>

      {partyEssentials && partyEssentials.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-foreground">Make it special</h2>
          <div className="mt-2 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {partyEssentials.map((item) => {
              const qty = partyEssentialQuantity(item);
              return (
                <div
                  key={item.id}
                  className="block w-24 shrink-0 rounded-md border border-border bg-card p-1.5"
                >
                  <Link to="/product/$productSlug" params={{ productSlug: item.slug }}>
                    <div className="aspect-square overflow-hidden rounded bg-muted">
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                      {item.name}
                    </p>
                    <p className="text-[11px] font-semibold text-primary">₹{item.price}</p>
                  </Link>
                  {qty === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 w-full px-0 text-[11px]"
                      onClick={() => addPartyEssential(item)}
                    >
                      Add
                    </Button>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between rounded-md border border-input">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => removePartyEssential(item)}
                        className="grid size-7 place-items-center hover:bg-muted"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-[11px] font-semibold">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one more ${item.name}`}
                        onClick={() => addPartyEssential(item)}
                        className="grid size-7 place-items-center hover:bg-muted"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-input">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid size-10 place-items-center text-foreground hover:bg-muted"
          >
            <Minus size={15} />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(50, q + 1))}
            className="grid size-10 place-items-center text-foreground hover:bg-muted"
          >
            <Plus size={15} />
          </button>
        </div>
        <Button
          size="lg"
          className="flex-1 sm:flex-none"
          onClick={handleAdd}
          disabled={price === undefined || outOfStock}
        >
          {added ? "Added!" : "Add to Cart"}
        </Button>
        <Button
          size="lg"
          variant="hero"
          className="flex-1 sm:flex-none"
          onClick={handleBuyNow}
          disabled={price === undefined || outOfStock}
        >
          Buy Now
        </Button>
        <button
          type="button"
          onClick={toggleWishlist}
          aria-pressed={inWishlist}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          className={`grid size-11 shrink-0 place-items-center rounded-md border border-input transition-colors hover:bg-muted ${inWishlist ? "border-primary text-primary" : "text-foreground/70"}`}
        >
          <Heart size={18} className={inWishlist ? "fill-primary" : ""} />
        </button>
      </div>
      {outOfStock && (
        <p className="mt-2 text-xs font-medium text-destructive">
          This cake is currently out of stock — check back soon or contact us for options.
        </p>
      )}
    </div>
  );
}
