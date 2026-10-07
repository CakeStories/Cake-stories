import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, ShieldCheck, Tag } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { LocationPickerDialog, type PickedLocation } from "@/components/location-picker-dialog";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { confirmCheckoutPayment, createCheckoutOrder, quoteCheckout } from "@/lib/checkout.server";
import {
  PICKUP_BRANCHES,
  TIME_SLOTS,
  deliveryFeeFor,
  earliestDelivery,
  hrefNeedsAdvanceNotice,
  isoDate,
  isSameDayStillBookable,
  timeSlotIndexForHour,
} from "@/lib/pricing";
import { readSavedDeliveryLocation } from "@/lib/delivery-location";
import { CheckoutInfoAccordion } from "@/components/checkout-info-accordion";
import { DEFAULT_PRODUCT_IMAGE, onProductImageError } from "@/lib/image-fallback";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

type FormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  fulfillmentType: "delivery" | "pickup";
  pickupBranch: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
};

type Quote = Awaited<ReturnType<typeof quoteCheckout>>;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutPage() {
  const { items, subtotal: localSubtotal, clear, applyPrices } = useCart();
  const { user, getAccessToken } = useAuth();
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    email: user?.email ?? "",
    address: "",
    city: "",
    pincode: "",
    fulfillmentType: "delivery",
    pickupBranch: PICKUP_BRANCHES[0] ?? "",
    deliveryDate: "",
    deliveryTime: TIME_SLOTS[0] ?? "",
    deliveryLat: null,
    deliveryLng: null,
  });
  const [status, setStatus] = useState<"idle" | "processing" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ orderRef: string; paymentId: string } | null>(
    null,
  );
  const [mapOpen, setMapOpen] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  // Fill in what we already know: the signed-in email, and the pincode/area
  // picked in the header's "Delivering to" menu.
  useEffect(() => {
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email }));
  }, [user?.email]);

  useEffect(() => {
    const saved = readSavedDeliveryLocation();
    if (saved?.pincode) {
      setForm((f) => ({
        ...f,
        pincode: f.pincode || saved.pincode || "",
        city: f.city || saved.city || "",
      }));
    }
  }, []);

  const handleLocationConfirm = (location: PickedLocation) => {
    setForm((f) => ({
      ...f,
      address: location.address,
      city: location.city || f.city,
      pincode: location.pincode || f.pincode,
      deliveryLat: location.lat,
      deliveryLng: location.lng,
    }));
  };

  // Wedding and Kids cakes need at least 24 hours' notice instead of same-day
  // delivery — and a cart mixing them with a same-day cake (e.g. Birthday)
  // takes the longer of the two, since it's one delivery for the whole order.
  // The server's quote knows each item's real category, so it also catches a
  // Wedding/Kids cake added from a page whose link doesn't reveal that.
  const needsAdvanceNotice = useMemo(
    () => quote?.needsAdvanceNotice || items.some((item) => hrefNeedsAdvanceNotice(item.href)),
    [items, quote?.needsAdvanceNotice],
  );
  const earliest = useMemo(() => earliestDelivery(needsAdvanceNotice), [needsAdvanceNotice]);
  const minDeliveryDate = isoDate(earliest);
  const minSlotIndexOnEarliestDate = timeSlotIndexForHour(earliest.getUTCHours());

  // If the cart changes (e.g. a Wedding cake gets added) and the date the
  // customer already picked is no longer far enough out, clear it so they
  // have to re-pick from what's actually available.
  useEffect(() => {
    setForm((f) => (f.deliveryDate && f.deliveryDate < minDeliveryDate ? { ...f, deliveryDate: "" } : f));
  }, [minDeliveryDate]);

  // Same idea for the time slot, on the earliest allowed day specifically.
  useEffect(() => {
    if (form.deliveryDate !== minDeliveryDate) return;
    const currentIndex = TIME_SLOTS.indexOf(form.deliveryTime);
    if (currentIndex !== -1 && currentIndex < minSlotIndexOnEarliestDate) {
      setForm((f) => ({
        ...f,
        deliveryTime: TIME_SLOTS[minSlotIndexOnEarliestDate] ?? TIME_SLOTS[TIME_SLOTS.length - 1]!,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.deliveryDate, minDeliveryDate, minSlotIndexOnEarliestDate]);

  const cartPayload = useMemo(
    () =>
      items.map((item) => ({
        ref: item.ref,
        quantity: item.quantity,
        ...(item.note && { note: item.note }),
        ...(item.specialInstructions && { instructions: item.specialInstructions }),
      })),
    [items],
  );
  // Prices are deliberately left out, so refreshing them doesn't trigger another quote.
  const quoteKey = JSON.stringify([cartPayload, appliedCode, form.fulfillmentType]);

  // Ask the server what this cart actually costs right now. Its answer is what
  // the customer will be charged, so show it — and correct any stale prices
  // saved in the cart.
  useEffect(() => {
    if (items.length === 0 || status === "success") return;
    let cancelled = false;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      quoteCheckout({
        data: {
          items: cartPayload,
          fulfillmentType: form.fulfillmentType,
          ...(appliedCode && { couponCode: appliedCode }),
        },
      })
        .then((result) => {
          if (cancelled) return;
          setQuote(result);
          const removed = result.unitPrices.filter((p) => p === null).length;
          const changed = result.unitPrices.some((p, i) => p !== null && p !== items[i]?.price);
          if (removed > 0) {
            setPriceNotice(
              `${removed} item${removed === 1 ? " is" : "s are"} no longer available and ${removed === 1 ? "was" : "were"} removed from your cart.`,
            );
          } else if (changed) {
            setPriceNotice(
              "Some prices have changed since you added them — your cart shows the current prices.",
            );
          }
          applyPrices(
            items.map((item, i) => ({ id: item.id, price: result.unitPrices[i] ?? null })),
          );
        })
        .catch((err) => {
          if (!cancelled)
            setError(err instanceof Error ? err.message : "Couldn't check current prices.");
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const quoteIsCurrent = quote !== null && !quoting;
  const subtotal = quoteIsCurrent ? quote.subtotal : localSubtotal;
  const discountAmount = quoteIsCurrent ? quote.discount : 0;
  const deliveryFee = quoteIsCurrent
    ? quote.deliveryFee
    : deliveryFeeFor(localSubtotal, form.fulfillmentType);
  const total = quoteIsCurrent ? quote.total : Math.max(0, subtotal - discountAmount + deliveryFee);
  const coupon = quote?.coupon;

  const updateField = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: event.target.value }));

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (code) setAppliedCode(code);
  };

  const removeCoupon = () => {
    setAppliedCode(null);
    setCouponInput("");
  };

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.deliveryDate) {
      setError(
        form.fulfillmentType === "pickup" ? "Choose a pickup date." : "Choose a delivery date.",
      );
      return;
    }
    if (coupon?.status === "invalid") {
      setError("Remove the promo code that can't be applied, or fix it, before paying.");
      return;
    }

    setStatus("processing");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Couldn't load the payment gateway. Check your connection and try again.");
      }

      const accessToken = user ? await getAccessToken() : null;

      // The server prices the cart, saves the order, and opens a Razorpay
      // order for that exact amount.
      const order = await createCheckoutOrder({
        data: {
          items: cartPayload,
          fulfillmentType: form.fulfillmentType,
          ...(appliedCode && { couponCode: appliedCode }),
          ...(accessToken && { accessToken }),
          details: {
            name: form.name,
            phone: form.phone,
            email: form.email,
            address: form.address,
            city: form.city,
            pincode: form.pincode,
            pickupBranch: form.pickupBranch,
            deliveryDate: form.deliveryDate,
            deliveryTime: form.deliveryTime,
            deliveryLat: form.deliveryLat,
            deliveryLng: form.deliveryLng,
          },
        },
      });

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Cake Stories",
        description: `Order for ${items.length} item${items.length === 1 ? "" : "s"}`,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: "#af1b37" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await confirmCheckoutPayment({
              data: {
                razorpayOrderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
            });
            if (!result.ok) {
              setStatus("error");
              setError(
                `We couldn't verify that payment. If money was deducted, contact us with payment ID ${response.razorpay_payment_id}.`,
              );
              return;
            }
            setConfirmation({ orderRef: result.orderRef, paymentId: response.razorpay_payment_id });
            clear();
            setStatus("success");
          } catch {
            setStatus("error");
            setError(
              `Your payment went through, but we couldn't confirm it here. We've saved your order — contact us with payment ID ${response.razorpay_payment_id} if you don't hear from us.`,
            );
          }
        },
        modal: {
          ondismiss: () => setStatus("idle"),
        },
      });

      razorpay.open();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong starting your payment.");
    }
  };

  if (status === "success") {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center lg:px-6">
          <CheckCircle2 className="mx-auto text-success" size={48} />
          <h1 className="mt-4 font-display text-3xl">Order placed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks{form.name ? `, ${form.name}` : ""} — we've received your order and will call you
            on {form.phone} if we need anything. Keep the reference below in case you need to
            contact us.
          </p>
          {confirmation && (
            <p className="mt-3 text-xs text-muted-foreground">
              Order reference: <strong className="text-foreground">{confirmation.orderRef}</strong>{" "}
              · Payment ID: {confirmation.paymentId}
            </p>
          )}
          {user && (
            <p className="mt-2 text-xs text-muted-foreground">
              You can also find it under{" "}
              <Link to="/account" className="underline">
                My account
              </Link>
              .
            </p>
          )}
          <Button className="mt-6" asChild>
            <Link to="/">Continue shopping</Link>
          </Button>
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center lg:px-6">
          <h1 className="font-display text-3xl">Your cart is empty</h1>
          {priceNotice && <p className="mt-2 text-sm text-muted-foreground">{priceNotice}</p>}
          <p className="mt-2 text-sm text-muted-foreground">Add a cake before checking out.</p>
          <Button className="mt-6" asChild>
            <Link to="/">Browse cakes</Link>
          </Button>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <h1 className="font-display text-3xl sm:text-4xl">Checkout</h1>

        {!user && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Link
              to="/login"
              search={{ redirect: "/checkout" }}
              className="font-medium text-primary underline"
            >
              Sign in
            </Link>{" "}
            to see this order in your account later.
          </p>
        )}

        {priceNotice && (
          <p
            role="status"
            className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground"
          >
            {priceNotice}
          </p>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <form id="checkout-form" onSubmit={handlePay} className="space-y-4">
              <h2 className="font-display text-xl">Delivery details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={form.name}
                  onChange={updateField("name")}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
                <Field
                  label="Phone number"
                  value={form.phone}
                  onChange={updateField("phone")}
                  required
                  type="tel"
                  maxLength={16}
                  autoComplete="tel"
                />
              </div>
              <Field
                label="Email"
                value={form.email}
                onChange={updateField("email")}
                required
                type="email"
                autoComplete="email"
              />

              <div className="flex gap-2">
                {(
                  [
                    { id: "delivery", label: "Delivery" },
                    { id: "pickup", label: "Store pickup" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, fulfillmentType: option.id }))}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                      form.fulfillmentType === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {form.fulfillmentType === "delivery" ? (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field
                        label="Delivery address"
                        value={form.address}
                        onChange={updateField("address")}
                        required
                        maxLength={500}
                        autoComplete="street-address"
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                      <MapPin size={15} /> Choose on map
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="City"
                      value={form.city}
                      onChange={updateField("city")}
                      required
                      maxLength={100}
                      autoComplete="address-level2"
                    />
                    <Field
                      label="Pincode"
                      value={form.pincode}
                      onChange={updateField("pincode")}
                      required
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      title="6-digit pincode"
                      autoComplete="postal-code"
                    />
                  </div>
                </>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">Pick up from</span>
                  <select
                    value={form.pickupBranch}
                    onChange={(e) => setForm((f) => ({ ...f, pickupBranch: e.target.value }))}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                  >
                    {PICKUP_BRANCHES.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">
                    {form.fulfillmentType === "pickup" ? "Pickup date" : "Delivery date"}
                  </span>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    min={minDeliveryDate}
                    required
                    onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">
                    {form.fulfillmentType === "pickup" ? "Pickup time" : "Delivery time"}
                  </span>
                  <select
                    value={form.deliveryTime}
                    onChange={(e) => setForm((f) => ({ ...f, deliveryTime: e.target.value }))}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                  >
                    {TIME_SLOTS.map((slot, index) => {
                      const tooSoon =
                        form.deliveryDate === minDeliveryDate && index < minSlotIndexOnEarliestDate;
                      return (
                        <option key={slot} value={slot} disabled={tooSoon}>
                          {slot}
                          {tooSoon ? " (too soon)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {needsAdvanceNotice ? (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Wedding and Kids cakes need at least 24 hours to prepare, so the earliest we can
                  deliver this order is{" "}
                  <strong className="text-foreground">
                    {new Date(`${minDeliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </strong>
                  .
                </p>
              ) : (
                <p className="-mt-2 text-xs text-muted-foreground">
                  {isSameDayStillBookable() ? (
                    <>
                      Same-day delivery is open until <strong className="text-foreground">3:00 PM</strong> —
                      order now and we'll show only the slots we can still make today.
                    </>
                  ) : (
                    <>
                      Today's same-day window has closed for new orders — earliest delivery is now{" "}
                      <strong className="text-foreground">
                        {new Date(`${minDeliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </strong>
                      .
                    </>
                  )}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={status === "processing" || quoting}
              >
                {status === "processing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing…
                  </>
                ) : quoting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Checking prices…
                  </>
                ) : (
                  `Pay ₹${total} with Razorpay`
                )}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={14} className="text-primary" /> Payments are handled securely by
                Razorpay — we never see your card details.
              </p>
            </form>

            <CheckoutInfoAccordion />
          </div>

          <aside className="h-fit rounded-md border border-border p-5">
            <h2 className="font-display text-xl">Order Summary</h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <img
                    src={item.image || DEFAULT_PRODUCT_IMAGE}
                    alt={item.name}
                    onError={onProductImageError}
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground">{item.variant}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                    {item.note && (
                      <p className="text-xs italic text-muted-foreground">"{item.note}"</p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs text-muted-foreground">
                        Note: {item.specialInstructions}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0">₹{item.price * item.quantity}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {form.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}
                {form.fulfillmentType === "pickup" && ` · ${form.pickupBranch}`}
              </p>
              <p>
                {form.deliveryDate
                  ? new Date(`${form.deliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Choose a date"}
                {" · "}
                {form.deliveryTime}
              </p>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {appliedCode && coupon?.status === "applied" ? (
                <div className="flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-sm text-success">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Tag size={14} /> {coupon.code} applied
                  </span>
                  <button type="button" onClick={removeCoupon} className="text-xs underline">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="Promo code"
                      maxLength={40}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm uppercase tracking-wide outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={(quoting && !!appliedCode) || !couponInput.trim()}
                      onClick={applyCoupon}
                    >
                      {quoting && appliedCode ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                  {appliedCode && coupon?.status === "invalid" && (
                    <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-destructive">
                      <span>{coupon.message}</span>
                      <button type="button" onClick={removeCoupon} className="shrink-0 underline">
                        Remove
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>₹{subtotal}</dd>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount</dt>
                  <dd>−₹{discountAmount}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {form.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}
                </dt>
                <dd>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>
                  {quoting ? <Loader2 size={14} className="inline animate-spin" /> : `₹${total}`}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <SiteFooter />

      <LocationPickerDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        onConfirm={handleLocationConfirm}
        initial={
          form.deliveryLat !== null && form.deliveryLng !== null
            ? { lat: form.deliveryLat, lng: form.deliveryLng }
            : null
        }
      />
    </main>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );
}
