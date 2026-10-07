import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, PackageOpen } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { useAuth } from "@/lib/auth";
import { getMyOrders, type OrderRecord } from "@/lib/orders";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading, getAccessToken, signOut } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", search: { redirect: "/account" } });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session expired. Please sign in again.");
        const rows = await getMyOrders(token);
        if (!cancelled) setOrders(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your orders.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24 lg:px-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="font-display text-3xl">My account</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut size={15} /> Sign out
          </Button>
        </header>

        <h2 className="mt-8 font-display text-xl">Your orders</h2>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}

        {!orders && !error ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading your orders…
          </p>
        ) : orders && orders.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
            <PackageOpen className="mx-auto text-muted-foreground" size={28} />
            <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
            <Button className="mt-4" asChild>
              <Link to="/">Browse cakes</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders?.map((order) => (
              <li key={order.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize">
                    {order.order_status.replace(/_/g, " ")}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {order.order_items.map((item, index) => (
                    <li key={index}>
                      {item.quantity} × {item.product_name}
                      {item.size ? ` (${item.size})` : ""} — ₹{item.unit_price}
                      {item.customization?.note && (
                        <span className="block text-xs italic">"{item.customization.note}"</span>
                      )}
                      {item.customization?.instructions && (
                        <span className="block text-xs text-muted-foreground">
                          Note: {item.customization.instructions}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <p className="capitalize">
                    {order.fulfillment_type === "pickup" ? "Store pickup" : "Delivery"}
                    {order.pickup_branch && ` · ${order.pickup_branch}`}
                  </p>
                  {(order.delivery_date || order.delivery_time) && (
                    <p>
                      {order.delivery_date &&
                        new Date(order.delivery_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      {order.delivery_time && ` · ${order.delivery_time}`}
                    </p>
                  )}
                  {order.coupon_code && (
                    <p>
                      Code <span className="font-semibold">{order.coupon_code}</span> applied — ₹
                      {order.discount_amount} off
                    </p>
                  )}
                </div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span>₹{order.total}</span>
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
