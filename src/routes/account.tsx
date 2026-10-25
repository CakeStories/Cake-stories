import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, PackageOpen } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { useAuth } from "@/lib/auth";
import { getMyOrders, type OrderRecord } from "@/lib/orders";
import { EditableText } from "@/components/editable";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading, getAccessToken, signOut } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", search: { redirect: "/account" } });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setError(null);
    setOrders(null);
    (async () => {
      const token = await getAccessToken().catch(() => null);
      if (!token) {
        if (!cancelled) setError("Your session expired. Please sign in again.");
        return;
      }
      // A patchy mobile connection often fails the first try — retry a couple of times quietly.
      for (let tries = 0; tries < 3; tries++) {
        try {
          const rows = await getMyOrders(token);
          if (!cancelled) setOrders(rows);
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 800 * (tries + 1)));
        }
      }
      if (!cancelled) setError("We couldn't load your order history just now.");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, attempt]);

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
            <EditableText id="account.title" as="h1" className="block font-display text-3xl">My account</EditableText>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut size={15} /> <EditableText id="account.signOut">Sign out</EditableText>
          </Button>
        </header>

        <EditableText id="account.orders" as="h2" className="mt-8 block font-display text-xl">Your orders</EditableText>

        {error ? (
          <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
            <PackageOpen className="mx-auto text-muted-foreground" size={28} />
            <EditableText id="account.error.title" as="p" className="mt-2 block text-sm font-semibold">No previous orders to show</EditableText>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button className="mt-4" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              <EditableText id="account.tryAgain">Try again</EditableText>
            </Button>
          </div>
        ) : !orders ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> <EditableText id="account.loading">Loading your orders…</EditableText>
          </p>
        ) : orders && orders.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
            <PackageOpen className="mx-auto text-muted-foreground" size={28} />
            <EditableText id="account.none.title" as="p" className="mt-2 block text-sm font-semibold">No previous orders</EditableText>
            <EditableText id="account.none.text" as="p" className="mt-1 block text-xs text-muted-foreground">Your order history will appear here.</EditableText>
            <Button className="mt-4" asChild>
              <Link to="/"><EditableText id="common.browseCakes">Browse cakes</EditableText></Link>
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
                          <EditableText id="cart.note">Note</EditableText>: {item.customization.instructions}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <p className="capitalize">
                    {order.fulfillment_type === "pickup" ? <EditableText id="account.pickup">Store pickup</EditableText> : <EditableText id="cart.delivery">Delivery</EditableText>}
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
                      <EditableText id="account.code">Code</EditableText> <span className="font-semibold">{order.coupon_code}</span>{" "}
                      <EditableText id="account.applied">applied</EditableText> — ₹{order.discount_amount} <EditableText id="price.off">off</EditableText>
                    </p>
                  )}
                </div>
                {Number(order.gst_amount) > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <EditableText id="account.includesGst">Includes GST of</EditableText> ₹{Number(order.gst_amount).toFixed(2)}
                  </p>
                )}
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
                  <EditableText id="account.total">Total</EditableText>
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
