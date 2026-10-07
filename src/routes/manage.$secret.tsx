import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Clock3,
  FolderPlus,
  ImageUp,
  Loader2,
  LogOut,
  Megaphone,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/button";
import {
  adminAddCategoryLink,
  adminAddVariant,
  adminCheckConfig,
  adminCheckOrderPayment,
  adminListOrders,
  adminUpdateOrderStatus,
  ORDER_STATUSES,
  type AdminOrder,
  adminCreateAddon,
  adminCreateBanner,
  adminCreateCategory,
  adminCreateCoupon,
  adminCreateProduct,
  adminDeleteAddon,
  adminDeleteBanner,
  adminDeleteCoupon,
  adminDeleteVariant,
  adminGetCatalog,
  adminGetStoreSettings,
  adminListAddons,
  adminListBanners,
  adminListCoupons,
  adminLogin,
  adminRemoveCategoryLink,
  adminUpdateAddon,
  adminUpdateBanner,
  adminUpdateCategory,
  adminUpdateCoupon,
  adminUpdateProduct,
  adminUpdateStoreSettings,
  adminUpdateVariant,
  adminUploadAddonImage,
  adminUploadBannerImage,
  adminUploadImage,
  adminVerifyUrlToken,
  type AdminAddon,
  type AdminBanner,
  type AdminCategory,
  type AdminCoupon,
  type AdminProduct,
  type AdminStoreSettings,
} from "@/lib/admin.server";

export const Route = createFileRoute("/manage/$secret")({
  // The real gate: this secret path segment is checked against
  // ADMIN_URL_TOKEN on the server before anything else loads. A wrong or
  // missing token gets an ordinary 404 — no login form, no hint that an
  // admin page exists at all. Bookmark the full URL; don't link it from
  // anywhere public.
  loader: async ({ params }) => {
    const { ok } = await adminVerifyUrlToken({ data: { candidate: params.secret } });
    if (!ok) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Admin | Cake Stories" },
      // Keep the dashboard out of search results.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const TOKEN_KEY = "cake-stories:admin-token";

function AdminPage() {
  const { secret: urlToken } = Route.useParams();
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    try {
      setToken(window.sessionStorage.getItem(TOKEN_KEY));
    } catch {
      // ignore storage errors
    }
    setBooted(true);
  }, []);

  const handleSignedIn = (newToken: string) => {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, newToken);
    } catch {
      // ignore storage errors
    }
    setToken(newToken);
  };

  const handleSignOut = () => {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
    setToken(null);
  };

  if (!booted) return null;

  return (
    <main className="min-h-screen bg-background">
      {token ? (
        <Dashboard token={token} onSignOut={handleSignOut} onAuthError={handleSignOut} />
      ) : (
        <LoginForm urlToken={urlToken} onSignedIn={handleSignedIn} />
      )}
    </main>
  );
}

/* --------------------------------------------------------------- login --- */

function LoginForm({
  urlToken,
  onSignedIn,
}: {
  urlToken: string;
  onSignedIn: (token: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      const result = await adminLogin({ data: { password, urlToken } });
      onSignedIn(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");

      // If sign-in failed, find out whether the server can actually see the
      // admin config, so the message points at the real problem.
      try {
        const config = await adminCheckConfig({ data: { urlToken } });
        setMissing(
          Object.entries(config)
            .filter(([, present]) => !present)
            .map(([key]) => key),
        );
      } catch {
        // Diagnostic is best-effort only.
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="font-display text-2xl">Cake Stories Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage prices and images.</p>

        <label className="mt-6 block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password) void submit();
            }}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {missing.length > 0 && (
          <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              The server can&apos;t see these variables:
            </p>
            <ul className="mt-1 list-inside list-disc">
              {missing.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Add them to <code>.env</code> and restart the dev server.
            </p>
          </div>
        )}

        <Button className="mt-5 w-full" disabled={!password || busy} onClick={() => void submit()}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- dashboard --- */

function Dashboard({
  token,
  onSignOut,
  onAuthError,
}: {
  token: string;
  onSignOut: () => void;
  onAuthError: () => void;
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminGetCatalog({ data: { token } });
      setCategories(result.categories);
      setProducts(result.products);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load the catalogue.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!term) return true;
      return product.name.toLowerCase().includes(term) || product.slug.toLowerCase().includes(term);
    });
  }, [products, categoryId, query]);

  const [tab, setTab] = useState<
    "orders" | "products" | "banners" | "store" | "extras" | "coupons" | "categories"
  >("orders");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-3xl">Catalogue admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage orders, prices, offers, photos and banners. Changes go live immediately.
          </p>
        </div>
        <Button variant="secondary" onClick={onSignOut}>
          <LogOut size={15} /> Sign out
        </Button>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-border">
        {(
          [
            { id: "orders", label: "Orders" },
            { id: "products", label: "Products & prices" },
            { id: "banners", label: "Homepage banners" },
            { id: "store", label: "Store & offers" },
            { id: "extras", label: "Extras & candles" },
            { id: "coupons", label: "Coupons" },
            { id: "categories", label: "Categories" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <OrdersPanel token={token} onAuthError={onAuthError} />
      ) : tab === "products" ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cakes…"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => setShowAddProduct((s) => !s)}>
              <Plus size={13} /> {showAddProduct ? "Cancel" : "Add new product"}
            </Button>
            {showAddProduct && (
              <AddProductForm
                token={token}
                categories={categories}
                defaultCategoryId={categoryId || categories[0]?.id || ""}
                onClose={() => setShowAddProduct(false)}
                onCreated={load}
              />
            )}
          </div>

          {error && (
            <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {loading && products.length === 0 ? (
            <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" /> Loading catalogue…
            </p>
          ) : (
            <>
              <p className="mt-5 text-sm text-muted-foreground">{visible.length} products</p>
              <div className="mt-4 space-y-4">
                {visible.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    token={token}
                    categories={categories}
                    onChanged={load}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : tab === "banners" ? (
        <BannersPanel token={token} categories={categories} onAuthError={onAuthError} />
      ) : tab === "store" ? (
        <StoreSettingsPanel token={token} onAuthError={onAuthError} />
      ) : tab === "extras" ? (
        <ExtrasPanel token={token} onAuthError={onAuthError} />
      ) : tab === "coupons" ? (
        <CouponsPanel token={token} onAuthError={onAuthError} />
      ) : (
        <CategoriesPanel token={token} onAuthError={onAuthError} onChanged={load} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ orders tab --- */

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatDate(isoDate: string) {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function OrdersPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [payment, setPayment] = useState<"paid" | "pending" | "all">("paid");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await adminListOrders({ data: { token, payment } }));
      setLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load orders.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, payment]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "paid", label: "Paid orders" },
            { id: "pending", label: "Awaiting payment" },
            { id: "all", label: "All" },
          ] as const
        ).map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={payment === option.id ? "default" : "secondary"}
            onClick={() => setPayment(option.id)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {payment === "pending" && (
        <p className="mt-3 text-xs text-muted-foreground">
          These customers started checkout but we never heard back from Razorpay — usually they
          closed the payment window. If someone says they paid, use "Check payment" to confirm it
          with Razorpay.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {!loaded && loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading orders…
        </p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No orders here yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} token={token} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  token,
  onChanged,
}: {
  order: AdminOrder;
  token: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const isPaid = order.payment_status === "paid";

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 3000);
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      flash(await action());
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (orderStatus: (typeof ORDER_STATUSES)[number]) =>
    run(async () => {
      if (
        orderStatus === "cancelled" &&
        !window.confirm("Mark this order as cancelled? Refunds are made separately in Razorpay.")
      ) {
        return "Not changed";
      }
      await adminUpdateOrderStatus({ data: { token, orderId: order.id, orderStatus } });
      onChanged();
      return "Status updated";
    });

  const checkPayment = () =>
    run(async () => {
      const result = await adminCheckOrderPayment({ data: { token, orderId: order.id } });
      if (result.paid) onChanged();
      return result.paid
        ? "Payment found — order confirmed"
        : "Razorpay has no successful payment for this order";
    });

  const mapUrl =
    order.delivery_lat !== null && order.delivery_lng !== null
      ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
      : null;

  return (
    <article
      className={`rounded-lg border p-4 ${isPaid ? "border-border bg-card" : "border-dashed border-input"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="mt-0.5 font-semibold">
            {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
            {order.delivery_date ? ` · ${formatDate(order.delivery_date)}` : ""}
            {order.delivery_time ? ` · ${order.delivery_time}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Placed{" "}
            {new Date(order.created_at).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPaid ? (
            <select
              value={order.order_status}
              disabled={busy}
              onChange={(e) => void changeStatus(e.target.value as (typeof ORDER_STATUSES)[number])}
              aria-label="Order status"
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          ) : (
            <>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Awaiting payment
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void checkPayment()}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{" "}
                Check payment
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-4 border-t border-border pt-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">{order.customer_name}</p>
          <p>
            <a href={`tel:${order.customer_phone}`} className="text-primary underline">
              {order.customer_phone}
            </a>
          </p>
          {order.customer_email && <p className="text-muted-foreground">{order.customer_email}</p>}
          <p className="mt-2 text-muted-foreground">
            {order.fulfillment_type === "pickup" ? order.pickup_branch : order.delivery_address}
          </p>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              Open pinned location in Maps
            </a>
          )}
        </div>
        <div>
          <ul className="space-y-1.5">
            {order.order_items.map((item, index) => (
              <li key={index}>
                <span className="font-medium">
                  {item.quantity} × {item.product_name}
                </span>
                {[item.size, item.flavour].filter(Boolean).length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({[item.size, item.flavour].filter(Boolean).join(" · ")})
                  </span>
                )}
                <span className="text-muted-foreground"> — ₹{item.unit_price * item.quantity}</span>
                {item.customization?.note && (
                  <span className="block text-xs">
                    Message on cake: <strong>"{item.customization.note}"</strong>
                  </span>
                )}
                {item.customization?.instructions && (
                  <span className="block text-xs text-muted-foreground">
                    Instructions: {item.customization.instructions}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>₹{order.subtotal}</dd>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
                <dd>−₹{order.discount_amount}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{order.delivery_charge === 0 ? "Free" : `₹${order.delivery_charge}`}</dd>
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <dt>Total{isPaid ? " paid" : ""}</dt>
              <dd>₹{order.total}</dd>
            </div>
          </dl>
          {order.razorpay_payment_id && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Payment ID: {order.razorpay_payment_id}
            </p>
          )}
        </div>
      </div>

      {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
    </article>
  );
}

/* --------------------------------------------------------- product row --- */

function ProductRow({
  product,
  token,
  categories,
  onChanged,
}: {
  product: AdminProduct;
  token: string;
  categories: AdminCategory[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [badge, setBadge] = useState(product.badge ?? "");
  const [deliveryEstimate, setDeliveryEstimate] = useState(product.delivery_estimate ?? "");
  const [tabGroup, setTabGroup] = useState(product.tab_group ?? "");
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.id, String(v.price)])),
  );
  const [mrps, setMrps] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.id, v.mrp !== null ? String(v.mrp) : ""])),
  );
  const [flavours, setFlavours] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.id, v.flavour ?? ""])),
  );

  // Re-sync local edit state whenever the catalogue reloads (e.g. after a
  // size is added/removed elsewhere), so a newly added variant shows its
  // real saved price instead of a blank input.
  useEffect(() => {
    setPrices(Object.fromEntries(product.variants.map((v) => [v.id, String(v.price)])));
    setMrps(
      Object.fromEntries(product.variants.map((v) => [v.id, v.mrp !== null ? String(v.mrp) : ""])),
    );
    setFlavours(Object.fromEntries(product.variants.map((v) => [v.id, v.flavour ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.variants]);
  const [newSize, setNewSize] = useState("");
  const [newFlavour, setNewFlavour] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outOfStock, setOutOfStock] = useState(product.out_of_stock);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      flash(successMessage);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCategoryLink = (categoryId: string, linked: boolean) =>
    run(
      async () => {
        if (linked) {
          await adminRemoveCategoryLink({ data: { token, productId: product.id, categoryId } });
        } else {
          await adminAddCategoryLink({ data: { token, productId: product.id, categoryId } });
        }
        onChanged();
      },
      linked ? "Removed from category" : "Added to category",
    );

  const saveDetails = () =>
    run(async () => {
      await adminUpdateProduct({
        data: {
          token,
          productId: product.id,
          name,
          description: description || null,
          badge: badge || null,
          delivery_estimate: deliveryEstimate.trim() || null,
          tab_group: tabGroup.trim() || null,
        },
      });
      onChanged();
    }, "Saved");

  const toggleOutOfStock = () =>
    run(async () => {
      const next = !outOfStock;
      await adminUpdateProduct({ data: { token, productId: product.id, out_of_stock: next } });
      setOutOfStock(next);
      onChanged();
    }, outOfStock ? "Marked back in stock" : "Marked out of stock");

  const savePrice = (variantId: string) =>
    run(async () => {
      const value = Number(prices[variantId]);
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid price.");

      const mrpRaw = mrps[variantId]?.trim() ?? "";
      let mrp: number | null | undefined = undefined;
      if (mrpRaw === "") {
        mrp = null; // explicitly clear any existing offer price
      } else {
        const parsed = Number(mrpRaw);
        if (!Number.isFinite(parsed) || parsed < 0)
          throw new Error("Enter a valid original price, or leave it blank.");
        if (parsed <= value)
          throw new Error("Original price must be higher than the sale price to show a discount.");
        mrp = parsed;
      }

      const flavour = flavours[variantId]?.trim() ?? "";
      await adminUpdateVariant({
        data: { token, variantId, price: value, mrp, flavour: flavour || null },
      });
      onChanged();
    }, "Price updated");

  const addVariant = () =>
    run(async () => {
      const value = Number(newPrice);
      if (!newSize.trim()) throw new Error("Enter a size.");
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid price.");
      await adminAddVariant({
        data: {
          token,
          productId: product.id,
          size: newSize.trim(),
          flavour: newFlavour.trim() || null,
          price: value,
        },
      });
      setNewSize("");
      setNewFlavour("");
      setNewPrice("");
      onChanged();
    }, "Size added");

  const removeVariant = (variantId: string, label: string) => {
    if (!window.confirm(`Remove the ${label} size from ${product.name}? This can't be undone.`))
      return;
    void run(async () => {
      await adminDeleteVariant({ data: { token, variantId } });
      onChanged();
    }, "Size removed");
  };

  const uploadImage = (file: File) =>
    run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });

      await adminUploadImage({
        data: {
          token,
          productId: product.id,
          fileName: file.name,
          contentType: file.type || "image/png",
          base64,
        },
      });
      onChanged();
    }, "Image updated");

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className={`h-full w-full object-cover ${outOfStock ? "opacity-50" : ""}`}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                No image
              </div>
            )}
            {outOfStock && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                Out of stock
              </span>
            )}
          </div>
          <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-muted">
            <ImageUp size={13} />
            Replace
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Badge (optional)</span>
              <input
                value={badge}
                placeholder="e.g. Trending, Just Launched"
                onChange={(e) => setBadge(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Shows as an animated pill under the name, on this cake's thumbnail and its page.
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Delivery time (optional)
              </span>
              <input
                value={deliveryEstimate}
                placeholder="Uses the site default"
                onChange={(e) => setDeliveryEstimate(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Shown at the bottom of this cake's thumbnail. Leave blank to use the site-wide
                delivery time set in Store Settings.
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Tab group (optional)
              </span>
              <input
                value={tabGroup}
                placeholder="e.g. Chocolate Obsession"
                onChange={(e) => setTabGroup(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Puts this cake under that tab in the "Shop by Flavour" rail at the top of Birthday
                Cakes. Must match a tab name exactly — manage the list of tabs and their order in
                Store Settings. Leave blank to leave it out of that rail.
              </span>
            </label>
          </div>

          <label className="mt-2 block text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Description</span>
            <textarea
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Also show in these categories
          </p>
          <p className="text-[11px] text-muted-foreground">
            Its own category is set by where you added it. Tick any others to also list it there —
            e.g. a cake that belongs in both Birthday Cakes and Wedding Cakes.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {categories
              .filter((c) => c.id !== product.category_id)
              .map((c) => {
                const linked = product.crossListedCategoryIds.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={linked}
                      disabled={busy}
                      onChange={() => toggleCategoryLink(c.id, linked)}
                      className="size-3.5"
                    />
                    {c.name}
                  </label>
                );
              })}
          </div>

          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Flavours, sizes, prices &amp; offers
          </p>
          <p className="text-[11px] text-muted-foreground">
            Each row is one flavour + size combination. Set an original price to show a
            strike-through discount; leave it blank for no offer.
          </p>
          <div className="mt-1.5 space-y-1.5">
            {product.variants.map((variant) => (
              <div key={variant.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={flavours[variant.id] ?? ""}
                  placeholder="Flavour"
                  aria-label={`Flavour for ${variant.size ?? "this size"}`}
                  onChange={(e) =>
                    setFlavours((f) => ({ ...f, [variant.id]: e.target.value }))
                  }
                  className="h-9 w-28 shrink-0 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="w-20 shrink-0 text-sm">{variant.size ?? "—"}</span>
                <span className="text-sm text-muted-foreground">₹</span>
                <input
                  value={prices[variant.id] ?? ""}
                  inputMode="decimal"
                  aria-label={`Sale price for ${variant.size ?? "size"}`}
                  onChange={(e) => setPrices((p) => ({ ...p, [variant.id]: e.target.value }))}
                  className="h-9 w-24 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">was ₹</span>
                <input
                  value={mrps[variant.id] ?? ""}
                  inputMode="decimal"
                  placeholder="none"
                  aria-label={`Original price for ${variant.size ?? "size"}`}
                  onChange={(e) => setMrps((p) => ({ ...p, [variant.id]: e.target.value }))}
                  className="h-9 w-24 rounded-md border border-dashed border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void savePrice(variant.id)}
                >
                  <Save size={13} /> Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove ${variant.size ?? "size"}`}
                  onClick={() => removeVariant(variant.id, variant.size ?? "this")}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                value={newFlavour}
                placeholder="Flavour (optional)"
                onChange={(e) => setNewFlavour(e.target.value)}
                className="h-9 w-28 rounded-md border border-dashed border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={newSize}
                placeholder="New size"
                onChange={(e) => setNewSize(e.target.value)}
                className="h-9 w-24 rounded-md border border-dashed border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground">₹</span>
              <input
                value={newPrice}
                inputMode="decimal"
                placeholder="Price"
                onChange={(e) => setNewPrice(e.target.value)}
                className="h-9 w-24 rounded-md border border-dashed border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void addVariant()}
              >
                <Plus size={13} /> Add
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" disabled={busy} onClick={() => void saveDetails()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
              details
            </Button>
            <Button
              size="sm"
              variant={outOfStock ? "secondary" : "outline"}
              disabled={busy}
              onClick={() => void toggleOutOfStock()}
            >
              {outOfStock ? <PackageCheck size={13} /> : <Ban size={13} />}
              {outOfStock ? "Mark back in stock" : "Mark out of stock"}
            </Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------- banners tab --- */

function BannersPanel({
  token,
  categories,
  onAuthError,
}: {
  token: string;
  categories: AdminCategory[];
  onAuthError: () => void;
}) {
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setBanners(await adminListBanners({ data: { token } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load banners.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const readAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.readAsDataURL(file);
    });

  const addBannerFromFile = async (file: File) => {
    setCreating(true);
    setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
      const base64 = await readAsBase64(file);
      const { imageUrl } = await adminUploadBannerImage({
        data: { token, fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      await adminCreateBanner({ data: { token, imageUrl, label: "", linkUrl: "/" } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that banner.");
    } finally {
      setCreating(false);
    }
  };

  const move = async (banner: AdminBanner, direction: -1 | 1) => {
    const sorted = [...banners].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((b) => b.id === banner.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    setBanners((prev) =>
      prev.map((b) => {
        if (b.id === banner.id) return { ...b, sort_order: swapWith.sort_order };
        if (b.id === swapWith.id) return { ...b, sort_order: banner.sort_order };
        return b;
      }),
    );

    try {
      await Promise.all([
        adminUpdateBanner({ data: { token, bannerId: banner.id, sortOrder: swapWith.sort_order } }),
        adminUpdateBanner({ data: { token, bannerId: swapWith.id, sortOrder: banner.sort_order } }),
      ]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reorder banners.");
      await load();
    }
  };

  const sorted = useMemo(() => [...banners].sort((a, b) => a.sort_order - b.sort_order), [banners]);

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        These images cycle at the top of the homepage, or sit on a specific category page — set each
        one's target below. Design each one with any text or offer baked into the picture
        (recommended size ~1600 × 640px) — nothing is drawn on top of it.
        {sorted.length === 0 &&
          " No banners are set here yet, so the site is showing its built-in default banners."}
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {loading && banners.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading banners…
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {sorted.map((banner, index) => (
            <BannerRow
              key={banner.id}
              banner={banner}
              token={token}
              categories={categories}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
              onChanged={load}
              onMove={(direction) => void move(banner, direction)}
            />
          ))}

          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-10 text-sm text-muted-foreground hover:bg-muted ${creating ? "pointer-events-none opacity-60" : ""}`}
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {creating ? "Uploading…" : "Add a new banner image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={creating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void addBannerFromFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function BannerRow({
  banner,
  token,
  categories,
  isFirst,
  isLast,
  onChanged,
  onMove,
}: {
  banner: AdminBanner;
  token: string;
  categories: AdminCategory[];
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [label, setLabel] = useState(banner.label);
  const [linkUrl, setLinkUrl] = useState(banner.link_url);
  const [active, setActive] = useState(banner.active);
  const [categoryId, setCategoryId] = useState(banner.category_id ?? "");
  const [position, setPosition] = useState<"top" | "bottom">(banner.position);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      flash(successMessage);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const trimmedUrl = linkUrl.trim();
      if (!trimmedUrl) throw new Error("Enter a link — use / for the homepage.");
      // A full URL (https://wa.me/..., https://instagram.com/...) always
      // opens in a new tab automatically; an in-site path like
      // /category/birthday-cakes navigates normally. No toggle to forget.
      const isExternal = /^https?:\/\//i.test(trimmedUrl);
      await adminUpdateBanner({
        data: {
          token,
          bannerId: banner.id,
          label,
          linkUrl: trimmedUrl,
          external: isExternal,
          active,
          categoryId: categoryId || null,
          position,
        },
      });
      onChanged();
    }, "Saved");

  const replaceImage = (file: File) =>
    run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });
      const { imageUrl } = await adminUploadBannerImage({
        data: { token, fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      await adminUpdateBanner({ data: { token, bannerId: banner.id, imageUrl } });
      onChanged();
    }, "Image updated");

  const remove = () => {
    if (!window.confirm("Remove this banner from the site? This can't be undone.")) return;
    void run(async () => {
      await adminDeleteBanner({ data: { token, bannerId: banner.id } });
      onChanged();
    }, "Removed");
  };

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          <div className="aspect-[5/2] overflow-hidden rounded-md bg-muted">
            <img src={banner.image_url} alt="" className="h-full w-full object-cover" />
          </div>
          <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-muted">
            <ImageUp size={13} />
            Replace image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void replaceImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Links to when tapped
              </span>
              <input
                value={linkUrl}
                placeholder="/category/birthday-cakes or https://wa.me/91..."
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                A page on this site (e.g. <code>/category/birthday-cakes</code>) or a full link
                starting with <code>https://</code> — a WhatsApp chat link (
                <code>https://wa.me/91XXXXXXXXXX</code>) opens in a new tab automatically.
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Accessible description
              </span>
              <input
                value={label}
                placeholder="What this banner shows, for screen readers"
                onChange={(e) => setLabel(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Visible on the site
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Show on</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Homepage</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Position on that page
              </span>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as "top" | "bottom")}
                disabled={!categoryId}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="top">Top of the page</option>
                <option value="bottom">Bottom of the page</option>
              </select>
            </label>
          </div>
          {!categoryId && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Set to Homepage, this banner cycles in the main carousel — position doesn't apply
              there.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || isFirst}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={13} /> Move up
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || isLast}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={13} /> Move down
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
              <Trash2 size={13} /> Remove
            </Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------- store & offers tab --- */

function StoreSettingsPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [settings, setSettings] = useState<AdminStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await adminGetStoreSettings({ data: { token } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load store settings.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading && !settings) {
    return (
      <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={15} className="animate-spin" /> Loading store settings…
      </p>
    );
  }

  if (!settings) {
    return (
      <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      <AnnouncementBarEditor token={token} settings={settings} onChanged={load} />
      <SitewideSaleEditor token={token} settings={settings} onChanged={load} />
      <DeliveryEstimatesEditor token={token} settings={settings} onChanged={load} />
      <BirthdayTabsEditor token={token} settings={settings} onChanged={load} />
    </div>
  );
}

function AnnouncementBarEditor({
  token,
  settings,
  onChanged,
}: {
  token: string;
  settings: AdminStoreSettings;
  onChanged: () => void;
}) {
  const [text, setText] = useState(settings.announcement_text);
  const [coupon, setCoupon] = useState(settings.announcement_coupon_code ?? "");
  const [active, setActive] = useState(settings.announcement_active);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (!text.trim()) throw new Error("Enter some text for the announcement bar.");
      await adminUpdateStoreSettings({
        data: {
          token,
          announcementText: text.trim(),
          announcementCouponCode: coupon,
          announcementActive: active,
        },
      });
      setStatus("Saved");
      onChanged();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(null), 2500);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-primary" />
        <h2 className="font-display text-xl">Top announcement bar</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        This strip shows at the very top of every page. Use it for delivery info, or swap it for a
        current offer — add a coupon code and it's shown alongside the text automatically.
      </p>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-foreground">Announcement text</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Freshly baked happiness, delivered across Tamil Nadu"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="mt-3 block text-sm sm:max-w-xs">
        <span className="mb-1 block font-medium text-foreground">Coupon code (optional)</span>
        <input
          value={coupon}
          onChange={(e) => setCoupon(e.target.value.toUpperCase())}
          placeholder="e.g. SWEET10"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm uppercase tracking-wide outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Shown as "Use code SWEET10" next to the text. Leave blank to hide it.
        </span>
      </label>

      <label className="mt-3 flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Show this bar on the site
      </label>

      {/* Live preview, matching how it actually renders in the header */}
      {active && text.trim() && (
        <div className="mt-4 rounded-md bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground sm:text-sm">
          {text}
          {coupon.trim() && (
            <>
              {" "}
              · Use code{" "}
              <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-bold tracking-wide">
                {coupon.trim()}
              </span>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </section>
  );
}

function DeliveryEstimatesEditor({
  token,
  settings,
  onChanged,
}: {
  token: string;
  settings: AdminStoreSettings;
  onChanged: () => void;
}) {
  const [birthday, setBirthday] = useState(settings.birthday_delivery_estimate);
  const [defaultEstimate, setDefaultEstimate] = useState(settings.default_delivery_estimate);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (!birthday.trim() || !defaultEstimate.trim())
        throw new Error("Enter both delivery estimates.");
      await adminUpdateStoreSettings({
        data: {
          token,
          birthdayDeliveryEstimate: birthday.trim(),
          defaultDeliveryEstimate: defaultEstimate.trim(),
        },
      });
      setStatus("Saved");
      onChanged();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(null), 2500);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Clock3 size={18} className="text-primary" />
        <h2 className="font-display text-xl">Delivery time shown on cakes</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown at the bottom of every cake's thumbnail, under the price. Birthday cakes get their own
        estimate; every other cake uses the default.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Birthday cakes</span>
          <input
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            placeholder="e.g. 90-120 mins"
            className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">All other cakes</span>
          <input
            value={defaultEstimate}
            onChange={(e) => setDefaultEstimate(e.target.value)}
            placeholder="e.g. 24 hours"
            className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </section>
  );
}

function BirthdayTabsEditor({
  token,
  settings,
  onChanged,
}: {
  token: string;
  settings: AdminStoreSettings;
  onChanged: () => void;
}) {
  const [tabs, setTabs] = useState<string[]>(settings.birthday_tabs);
  const [newTab, setNewTab] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setTabs(settings.birthday_tabs);
  }, [settings.birthday_tabs]);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      await adminUpdateStoreSettings({ data: { token, birthdayTabs: next } });
      setTabs(next);
      onChanged();
      flash("Saved");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const addTab = () => {
    const label = newTab.trim();
    if (!label) return;
    if (tabs.includes(label)) {
      flash("That tab already exists.");
      return;
    }
    setNewTab("");
    void save([...tabs, label]);
  };

  const removeTab = (label: string) => {
    if (!window.confirm(`Remove the "${label}" tab? Cakes set to it will just stop appearing in the rail — their tab field isn't changed.`))
      return;
    void save(tabs.filter((t) => t !== label));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-xl">Birthday Cake tabs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The "Shop by Flavour" tab rail at the top of the Birthday Cakes page. Add the tabs you want,
        in the order they should appear — then open each cake under Products &amp; prices and set
        its "Tab group" to one of these names exactly, to put it under that tab.
      </p>

      <div className="mt-4 space-y-1.5">
        {tabs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tabs yet — add one below. The rail stays hidden until at least one tab has cakes
            assigned to it.
          </p>
        )}
        {tabs.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
              {label}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || index === 0}
              onClick={() => move(index, -1)}
              aria-label={`Move ${label} up`}
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || index === tabs.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Move ${label} down`}
            >
              <ArrowDown size={13} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => removeTab(label)}
              aria-label={`Remove ${label}`}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newTab}
          placeholder="e.g. Timeless Favourites"
          onChange={(e) => setNewTab(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTab();
          }}
          className="h-9 w-full max-w-xs rounded-md border border-dashed border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" variant="secondary" disabled={busy} onClick={addTab}>
          <Plus size={13} /> Add tab
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </section>
  );
}

function SitewideSaleEditor({
  token,
  settings,
  onChanged,
}: {
  token: string;
  settings: AdminStoreSettings;
  onChanged: () => void;
}) {
  const [percent, setPercent] = useState(
    settings.sitewide_discount_percent !== null ? String(settings.sitewide_discount_percent) : "",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isLive = settings.sitewide_discount_active;

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 3000);
  };

  const startSale = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 1 || value > 90) {
      flash("Enter a percentage between 1 and 90.");
      return;
    }
    setBusy(true);
    try {
      await adminUpdateStoreSettings({
        data: { token, sitewideDiscountPercent: value, sitewideDiscountActive: true },
      });
      onChanged();
      flash(`Live: ${value}% off everywhere`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't start the sale.");
    } finally {
      setBusy(false);
    }
  };

  const endSale = async () => {
    setBusy(true);
    try {
      await adminUpdateStoreSettings({ data: { token, sitewideDiscountActive: false } });
      onChanged();
      flash("Sale ended");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't end the sale.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-xl">Run a sitewide sale</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One switch to put every product on sale at once — every price on the site shows this
        discount immediately, overriding any individual offer price while it's on. Turning it off
        instantly restores normal prices; nothing about individual products is changed or lost.
      </p>

      {isLive && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-success/15 px-3 py-2 text-sm font-semibold text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live now — {settings.sitewide_discount_percent}% off every product
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Discount</span>
          <span className="flex items-center gap-1.5">
            <input
              value={percent}
              inputMode="decimal"
              disabled={busy}
              onChange={(e) => setPercent(e.target.value)}
              className="h-10 w-20 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">% off</span>
          </span>
        </label>

        {isLive ? (
          <Button variant="secondary" disabled={busy} onClick={() => void endSale()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} End sale
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void startSale()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Start sale
          </Button>
        )}

        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- extras tab --- */

const ADDON_CATEGORIES = ["Candles", "Number-Candles", "Celebration-Essentials"];

function ExtrasPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setAddons(await adminListAddons({ data: { token } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load extras.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, AdminAddon[]>();
    for (const addon of addons) {
      const list = byCategory.get(addon.category) ?? [];
      list.push(addon);
      byCategory.set(addon.category, list);
    }
    return byCategory;
  }, [addons]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          These show up in the "Make it extra special" popup on a cake's page — candles, number
          candles, and any other add-ons you want to sell alongside a cake.
        </p>
        <Button size="sm" onClick={() => setShowAddForm((s) => !s)}>
          <Plus size={13} /> Add extra
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {showAddForm && (
        <AddAddonForm token={token} onClose={() => setShowAddForm(false)} onCreated={load} />
      )}

      {loading && addons.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading extras…
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {[
            // The usual categories first, then any custom ones the owner added.
            ...ADDON_CATEGORIES.filter((c) => grouped.has(c)),
            ...[...grouped.keys()].filter((c) => !ADDON_CATEGORIES.includes(c)),
          ].map((category) => (
            <div key={category}>
              <h3 className="font-display text-lg">{category}</h3>
              <div className="mt-3 space-y-3">
                {grouped.get(category)!.map((addon) => (
                  <AddonRow key={addon.id} addon={addon} token={token} onChanged={load} />
                ))}
              </div>
            </div>
          ))}
          {addons.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No extras yet — add your first one above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AddAddonForm({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState(ADDON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const finalCategory = category === "__custom" ? customCategory.trim() : category;
      const priceValue = Number(price);
      if (!finalCategory) throw new Error("Choose or enter a category.");
      if (!name.trim()) throw new Error("Enter a name.");
      if (!Number.isFinite(priceValue) || priceValue < 0) throw new Error("Enter a valid price.");

      await adminCreateAddon({
        data: { token, category: finalCategory, name: name.trim(), price: priceValue },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-input p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {ADDON_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__custom">New category…</option>
          </select>
          {category === "__custom" && (
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Category name"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sparkle Candle"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Price</span>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder="75"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AddonRow({
  addon,
  token,
  onChanged,
}: {
  addon: AdminAddon;
  token: string;
  onChanged: () => void;
}) {
  const [name, setName] = useState(addon.name);
  const [price, setPrice] = useState(String(addon.price));
  const [active, setActive] = useState(addon.active);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      flash(successMessage);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const priceValue = Number(price);
      if (!Number.isFinite(priceValue) || priceValue < 0) throw new Error("Enter a valid price.");
      await adminUpdateAddon({
        data: { token, addonId: addon.id, name, price: priceValue, active },
      });
      onChanged();
    }, "Saved");

  const uploadImage = (file: File) =>
    run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });
      const { imageUrl } = await adminUploadAddonImage({
        data: { token, fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      await adminUpdateAddon({ data: { token, addonId: addon.id, imageUrl } });
      onChanged();
    }, "Image updated");

  const remove = () => {
    if (
      !window.confirm(`Delete "${addon.name}"? To hide it for now instead, untick Active and save.`)
    )
      return;
    void run(async () => {
      await adminDeleteAddon({ data: { token, addonId: addon.id } });
      onChanged();
    }, "Removed");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {addon.image_url ? (
          <img src={addon.image_url} alt={addon.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-lg">🕯️</div>
        )}
      </div>
      <label className="shrink-0 cursor-pointer text-xs font-medium text-primary underline">
        Change photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadImage(file);
            e.target.value = "";
          }}
        />
      </label>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-sm text-muted-foreground">₹</span>
      <input
        value={price}
        inputMode="decimal"
        onChange={(e) => setPrice(e.target.value)}
        className="h-9 w-20 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void save()}>
        <Save size={13} /> Save
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
        <Trash2 size={13} />
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}

/* ------------------------------------------------------------- coupons tab --- */

function CouponsPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCoupons(await adminListCoupons({ data: { token } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load coupons.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Codes customers type in at checkout. For "X% off everything" without a code, use the{" "}
          <strong>Store &amp; offers</strong> tab instead — these are for specific promo codes.
        </p>
        <Button size="sm" onClick={() => setShowAddForm((s) => !s)}>
          <Plus size={13} /> New code
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {showAddForm && (
        <AddCouponForm token={token} onClose={() => setShowAddForm(false)} onCreated={load} />
      )}

      {loading && coupons.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading coupons…
        </p>
      ) : coupons.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No coupon codes yet — add your first one above.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {coupons.map((coupon) => (
            <CouponRow key={coupon.id} coupon={coupon} token={token} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

const couponInputClass =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

type CouponFields = {
  discountType: "percent" | "amount";
  discountValue: string;
  minOrder: string;
  maxUses: string;
  expiresOn: string; // YYYY-MM-DD, or "" for never
};

/** Validates the shared coupon inputs and converts them to server values. */
function parseCouponFields(fields: CouponFields) {
  const discountValue = Number(fields.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0)
    throw new Error("Enter a valid discount.");
  if (fields.discountType === "percent" && discountValue > 90)
    throw new Error("Percentage discounts must be 90% or less.");

  const minOrderAmount = fields.minOrder.trim() ? Number(fields.minOrder) : null;
  if (minOrderAmount !== null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
    throw new Error("Enter a valid minimum order, or leave it blank.");
  }

  const maxUses = fields.maxUses.trim() ? Number(fields.maxUses) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    throw new Error("Usage limit must be a whole number, or blank for unlimited.");
  }

  return {
    discountType: fields.discountType,
    discountValue,
    minOrderAmount,
    maxUses,
    expiresAt: fields.expiresOn || null,
  };
}

function CouponFieldsEditor({
  fields,
  onChange,
}: {
  fields: CouponFields;
  onChange: (next: CouponFields) => void;
}) {
  const set =
    (key: keyof CouponFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...fields, [key]: e.target.value });

  return (
    <>
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Type</span>
        <select
          value={fields.discountType}
          onChange={set("discountType")}
          className={couponInputClass}
        >
          <option value="percent">% off</option>
          <option value="amount">₹ off</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">
          {fields.discountType === "percent" ? "Percent" : "Amount (₹)"}
        </span>
        <input
          value={fields.discountValue}
          inputMode="decimal"
          onChange={set("discountValue")}
          placeholder={fields.discountType === "percent" ? "10" : "100"}
          className={couponInputClass}
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Min order (₹)</span>
        <input
          value={fields.minOrder}
          inputMode="decimal"
          onChange={set("minOrder")}
          placeholder="none"
          className={couponInputClass}
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Usage limit</span>
        <input
          value={fields.maxUses}
          inputMode="numeric"
          onChange={set("maxUses")}
          placeholder="unlimited"
          className={couponInputClass}
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Last valid day</span>
        <input
          type="date"
          value={fields.expiresOn}
          onChange={set("expiresOn")}
          className={couponInputClass}
        />
      </label>
    </>
  );
}

function AddCouponForm({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [fields, setFields] = useState<CouponFields>({
    discountType: "percent",
    discountValue: "",
    minOrder: "",
    maxUses: "",
    expiresOn: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!code.trim()) throw new Error("Enter a code.");
      await adminCreateCoupon({ data: { token, code: code.trim(), ...parseCouponFields(fields) } });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-input p-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
            maxLength={40}
            placeholder="SWEET10"
            className={`${couponInputClass} uppercase`}
          />
        </label>
        <CouponFieldsEditor fields={fields} onChange={setFields} />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create code
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function isoDateInIst(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function couponFieldsFrom(coupon: AdminCoupon): CouponFields {
  return {
    discountType: coupon.discount_type,
    discountValue: String(coupon.discount_value),
    minOrder: coupon.min_order_amount != null ? String(coupon.min_order_amount) : "",
    maxUses: coupon.max_uses != null ? String(coupon.max_uses) : "",
    // Stored as the end of that day in IST; the date part is the day itself.
    expiresOn: coupon.expires_at ? isoDateInIst(coupon.expires_at) : "",
  };
}

function CouponRow({
  coupon,
  token,
  onChanged,
}: {
  coupon: AdminCoupon;
  token: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<CouponFields>(() => couponFieldsFrom(coupon));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      flash(successMessage);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = () =>
    run(
      async () => {
        await adminUpdateCoupon({ data: { token, couponId: coupon.id, active: !coupon.active } });
        onChanged();
      },
      coupon.active ? "Disabled" : "Enabled",
    );

  const save = () =>
    run(async () => {
      await adminUpdateCoupon({
        data: { token, couponId: coupon.id, ...parseCouponFields(fields) },
      });
      setEditing(false);
      onChanged();
    }, "Saved");

  const remove = () => {
    if (
      !window.confirm(`Delete the code ${coupon.code}? Customers won't be able to use it any more.`)
    )
      return;
    void run(async () => {
      await adminDeleteCoupon({ data: { token, couponId: coupon.id } });
      onChanged();
    }, "Deleted");
  };

  const expired = coupon.expires_at !== null && new Date(coupon.expires_at).getTime() < Date.now();
  const usedUp = coupon.max_uses !== null && coupon.times_used >= coupon.max_uses;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Tag size={15} className="shrink-0 text-primary" />
        <span className="font-mono text-sm font-semibold">{coupon.code}</span>
        <span className="text-sm text-muted-foreground">
          {coupon.discount_type === "percent"
            ? `${coupon.discount_value}% off`
            : `₹${coupon.discount_value} off`}
          {coupon.min_order_amount ? ` · min order ₹${coupon.min_order_amount}` : ""}
          {` · used ${coupon.times_used}${coupon.max_uses !== null ? ` of ${coupon.max_uses}` : ""}`}
          {coupon.expires_at ? ` · valid through ${isoDateInIst(coupon.expires_at)}` : ""}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
            coupon.active && !expired && !usedUp
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {!coupon.active ? "Disabled" : expired ? "Expired" : usedUp ? "Used up" : "Active"}
        </span>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void toggleActive()}>
          {coupon.active ? "Disable" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setFields(couponFieldsFrom(coupon));
            setEditing((e) => !e);
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label={`Delete ${coupon.code}`}
          onClick={remove}
        >
          <Trash2 size={13} />
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
      {editing && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <CouponFieldsEditor fields={fields} onChange={setFields} />
          </div>
          <Button size="sm" className="mt-3" disabled={busy} onClick={() => void save()}>
            <Save size={13} /> Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------- add product form --- */

function AddProductForm({
  token,
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: {
  token: string;
  categories: AdminCategory[];
  defaultCategoryId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("1 kg");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const priceValue = Number(price);
      if (!categoryId) throw new Error("Choose a category.");
      if (!name.trim()) throw new Error("Enter a name.");
      if (!size.trim()) throw new Error("Enter a size.");
      if (!Number.isFinite(priceValue) || priceValue < 0) throw new Error("Enter a valid price.");

      await adminCreateProduct({
        data: {
          token,
          categoryId,
          name: name.trim(),
          description: description.trim() || null,
          size: size.trim(),
          price: priceValue,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-input p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rose Garden Cake"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-muted-foreground">
            Description (optional)
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short line shown on the product page"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Starting size</span>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="1 kg"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Price</span>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder="999"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        You can add more sizes, a photo, and other details once it's created — it'll appear in the
        list below.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
          product
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- categories tab --- */

function CategoriesPanel({
  token,
  onAuthError,
  onChanged,
}: {
  token: string;
  onAuthError: () => void;
  onChanged: () => void;
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminGetCatalog({ data: { token } });
      setCategories(result.categories);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load categories.";
      setError(message);
      if (message.toLowerCase().includes("session")) onAuthError();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refresh = () => {
    void load();
    onChanged();
  };

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  const move = async (category: AdminCategory, direction: -1 | 1) => {
    const index = sorted.findIndex((c) => c.id === category.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    try {
      await Promise.all([
        adminUpdateCategory({
          data: { token, categoryId: category.id, sortOrder: swapWith.sort_order },
        }),
        adminUpdateCategory({
          data: { token, categoryId: swapWith.id, sortOrder: category.sort_order },
        }),
      ]);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reorder categories.");
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Rename any category, write a banner for its page, reorder them, or hide one without
          deleting it. Add a brand new category here — for a running promotion (Valentine's Day,
          say), give it a name and add products to it from the Products tab, then rename or retire
          it later whenever you like.
        </p>
        <Button size="sm" onClick={() => setShowAddForm((s) => !s)}>
          <FolderPlus size={13} /> New category
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {showAddForm && (
        <AddCategoryForm token={token} onClose={() => setShowAddForm(false)} onCreated={refresh} />
      )}

      {loading && categories.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading categories…
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {sorted.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              token={token}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
              onChanged={refresh}
              onMove={(direction) => void move(category, direction)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddCategoryForm({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Enter a name.");
      await adminCreateCategory({ data: { token, name: name.trim() } });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-input p-4">
      <label className="block text-xs sm:max-w-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Category name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Valentine's Day Specials"
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />} Create
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  token,
  isFirst,
  isLast,
  onChanged,
  onMove,
}: {
  category: AdminCategory;
  token: string;
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [name, setName] = useState(category.name);
  const [bannerText, setBannerText] = useState(category.banner_text ?? "");
  const [active, setActive] = useState(category.active);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error("Name can't be empty.");
      await adminUpdateCategory({
        data: {
          token,
          categoryId: category.id,
          name: name.trim(),
          bannerText: bannerText.trim() || null,
          active,
        },
      });
      onChanged();
      flash("Saved");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            Name (shown in the menu)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            Page URL (fixed — renaming above won't break links)
          </span>
          <input
            value={category.slug}
            disabled
            className="h-9 w-full rounded-md border border-input bg-muted px-2.5 text-sm text-muted-foreground outline-none"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-muted-foreground">
            Banner text on this category's page (optional — leave blank for no banner)
          </span>
          <input
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder="e.g. Valentine's Day Specials — 14 Feb only, pre-order now!"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Visible in the menu
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || isFirst} onClick={() => onMove(-1)}>
          <ArrowUp size={13} /> Move up
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || isLast} onClick={() => onMove(1)}>
          <ArrowDown size={13} /> Move down
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </article>
  );
}
