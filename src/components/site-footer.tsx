import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Clock,
  Facebook,
  Heart,
  Instagram,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/button";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { subscribeToNewsletter } from "@/lib/newsletter.server";
import { BRANCH_LOCATIONS } from "@/lib/delivery-location";

const CONTACT_PHONE = "+91 78087 80852";
const WHATSAPP_NUMBER = "+91 78087 80852";
const CONTACT_EMAIL = "cakepalettee@gmail.com";
const INSTAGRAM_URL = "https://www.instagram.com/cakestoriesofficial/";
const FACEBOOK_URL = "https://www.facebook.com/cakestoriesofficial";
const BUSINESS_HOURS = "9:00 AM – 9:00 PM, every day";

export function SiteFooter() {
  return (
    <>
      <section className="border-b border-border bg-background py-12">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Fresh from the oven
            </p>
            <h2 className="mt-2 font-display text-3xl">Get our newsletter updates</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              New flavours, celebration ideas and special offers, sent occasionally.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </section>

      <footer className="bg-foreground py-12 text-background">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <img
                src="/cake-stories-logo.webp"
                alt="Cake Stories"
                className="h-10 w-auto brightness-0 invert"
              />
              <p className="mt-3 max-w-xs text-sm text-background/65">
                Handcrafted cakes for every chapter worth celebrating.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Cake Stories on Instagram"
                  className="flex size-9 items-center justify-center rounded-full bg-background/10 text-background transition hover:bg-background/20"
                >
                  <Instagram size={17} />
                </a>
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Cake Stories on Facebook"
                  className="flex size-9 items-center justify-center rounded-full bg-background/10 text-background transition hover:bg-background/20"
                >
                  <Facebook size={17} />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-background/50">
                Get in touch
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-background/75">
                <li>
                  <a
                    href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 hover:text-background"
                  >
                    <Phone size={15} className="shrink-0 text-background/50" />
                    {CONTACT_PHONE}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-background"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-[15px] shrink-0 text-background/50">
                      <path d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12.004 2.004c-5.514 0-9.996 4.482-9.996 9.996 0 1.763.464 3.489 1.346 5.005L2 22l5.117-1.341a9.96 9.96 0 0 0 4.887 1.244h.004c5.514 0 9.996-4.483 9.996-9.996 0-2.67-1.04-5.18-2.928-7.07a9.93 9.93 0 0 0-7.072-2.93zm0 18.17h-.003a8.26 8.26 0 0 1-4.212-1.154l-.302-.18-3.037.796.81-2.96-.198-.304a8.263 8.263 0 0 1-1.269-4.372c0-4.564 3.714-8.278 8.277-8.278 2.211 0 4.288.861 5.851 2.425a8.22 8.22 0 0 1 2.422 5.854c0 4.563-3.713 8.173-8.339 8.173z" />
                    </svg>
                    WhatsApp us
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="flex items-center gap-2 hover:text-background"
                  >
                    <Mail size={15} className="shrink-0 text-background/50" />
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={15} className="shrink-0 text-background/50" />
                  {BUSINESS_HOURS}
                </li>
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-background/50">
                Our shops
              </h3>
              <div className="mt-3 grid gap-5 sm:grid-cols-3">
                {BRANCH_LOCATIONS.map((branch) => (
                  <div key={branch.id} className="text-sm text-background/75">
                    <p className="font-medium text-background">{branch.label}</p>
                    <p className="mt-1 flex gap-1.5 text-background/65">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-background/50" />
                      <span>{branch.address}</span>
                    </p>
                    {branch.phone && (
                      <a
                        href={`tel:${branch.phone.replace(/\s/g, "")}`}
                        className="mt-1 flex items-center gap-1.5 hover:text-background"
                      >
                        <Phone size={14} className="shrink-0 text-background/50" />
                        {branch.phone}
                      </a>
                    )}
                    {branch.mapsUrl && (
                      <a
                        href={branch.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium underline underline-offset-2 text-background/60 hover:text-background"
                      >
                        Get directions
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-background/10 pt-6 text-sm text-background/60">
            <span>© {new Date().getFullYear()} Cake Stories. All rights reserved.</span>
            <div className="flex flex-wrap gap-5">
              <span>Freshly baked</span>
              <span>Secure payments</span>
              <span>Careful delivery</span>
            </div>
          </div>
        </div>
      </footer>

      <MobileTabBar />
    </>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("busy");
    try {
      await subscribeToNewsletter({ data: { email } });
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="w-full max-w-md text-sm font-medium text-success">
        Thanks — you're on the list!
      </p>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form className="flex gap-2" onSubmit={submit}>
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Subscribing…" : "Subscribe"}
        </Button>
      </form>
      {state === "error" && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          Couldn't sign you up just now — please try again.
        </p>
      )}
    </div>
  );
}

function MobileTabBar() {
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // "Filter & sort" only makes sense where there's a product list to filter —
  // the homepage's shop section, or a category listing. On a single-product
  // page (cart, wishlist, a cake's own page) there's nothing to jump to, so
  // we point it at the nearest place that does have sort/filter controls
  // instead of always bouncing to the homepage.
  const isCategoryPage = pathname.startsWith("/category/");
  const filterSortHref = isCategoryPage ? pathname : "/";
  const filterSortHash = isCategoryPage ? "sort" : "shop";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-background px-3 py-2 md:hidden">
      <Button variant="ghost" className="h-12 flex-col gap-1 text-[10px]" asChild>
        <Link to="/wishlist">
          <Heart size={18} />
          Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
        </Link>
      </Button>
      <Button variant="ghost" className="h-12 flex-col gap-1 text-[10px]" asChild>
        <Link to={filterSortHref} hash={filterSortHash}>
          <SlidersHorizontal size={18} />
          Filter & sort
        </Link>
      </Button>
      <Button variant="ghost" className="relative h-12 flex-col gap-1 text-[10px]" asChild>
        <Link to="/cart">
          <ShoppingBag size={18} />
          Bag {itemCount > 0 && `(${itemCount})`}
        </Link>
      </Button>
    </div>
  );
}
