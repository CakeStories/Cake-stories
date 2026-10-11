import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CakeSlice,
  ChevronDown,
  Clock,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/button";
import { useQuery } from "@tanstack/react-query";
import { categories as staticCategories } from "@/lib/static-categories";
import { getCategories } from "@/lib/categories";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useStoreSettings } from "@/lib/store-settings";
import { BRANCH_LOCATIONS, isPickupLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { flavours } from "@/lib/flavour-list";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/recent-searches";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import iconBirthdayCakes from "@/assets/category-icon-birthday-cakes.png";
import iconWeddingCakes from "@/assets/category-icon-wedding-cakes.png";
import iconKidsCakes from "@/assets/category-icon-kids-cakes.png";
import iconHolyCommunion from "@/assets/category-icon-holy-communion.png";
import iconBirthdayBash from "@/assets/category-icon-birthday-bash.png";
import iconPartyEssentials from "@/assets/category-icon-party-essentials.png";
import iconNewArrivals from "@/assets/category-icon-new-arrivals.png";

// Per-category nav icons — anything not in this list (a category the shop
// owner adds themselves from /manage) falls back to the generic CakeSlice icon.
const CATEGORY_ICONS: Record<string, string> = {
  "birthday-cakes": iconBirthdayCakes,
  "wedding-cakes": iconWeddingCakes,
  "kids-cakes": iconKidsCakes,
  "holy-communion-cakes": iconHolyCommunion,
  "birthday-bash": iconBirthdayBash,
  "party-essentials": iconPartyEssentials,
  "new-arrivals": iconNewArrivals,
};

// The panel shown under the search box before the customer has typed
// anything — their recent searches plus every category/flavour they can
// jump straight to, so they don't have to type at all if they don't want to.
function SearchDropdown({
  categories,
  onNavigate,
  onPickRecent,
}: {
  categories: { slug: string; name: string }[];
  onNavigate: () => void;
  onPickRecent: (term: string) => void;
}) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  return (
    <div
      // Keeps the input focused when a link/button inside is pressed, so the
      // input's onBlur (which closes this panel) never fires before the
      // click is registered.
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[75vh] overflow-y-auto rounded-lg border border-border bg-background p-4 text-left shadow-lg"
    >
      {recent.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent searches
            </span>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => setRecent(clearRecentSearches())}
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1.5 pl-3 pr-2 text-xs font-medium"
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5"
                  onClick={() => onPickRecent(term)}
                >
                  <Clock size={12} className="text-muted-foreground" />
                  {term}
                </button>
                <button
                  type="button"
                  aria-label={`Remove "${term}" from recent searches`}
                  onClick={() => setRecent(removeRecentSearch(term))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Shop by category
        </span>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$categorySlug"
              params={{ categorySlug: c.slug }}
              onClick={onNavigate}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Popular flavours
        </span>
        <div className="flex flex-wrap gap-2">
          {flavours.map((f) => (
            <Link
              key={f.slug}
              to="/flavour/$flavourSlug"
              params={{ flavourSlug: f.slug }}
              onClick={onNavigate}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "Delivering to" picker: type a pincode, or choose one of our shops. Cakes are
 * delivered only within 15 km of Marthandam — a pincode outside that area is
 * refused with a clear "Not deliverable to this location". A popover (not a
 * dropdown menu, which swallows typed digits) so it works on touch screens.
 */
function DeliveryLocationPicker({ variant }: { variant: "desktop" | "mobile" }) {
  const { location, setBranch, setByPincode } = useDeliveryLocation();
  const [open, setOpen] = useState(false);
  // "Pickup from Anducode" when a shop was chosen, "Delivering to …" for a pincode.
  const prefix = isPickupLocation(location) ? "Pickup from" : "Delivering to";
  const [pincode, setPincode] = useState("");
  const [status, setStatus] = useState<{
    loading: boolean;
    error: string | null;
    notDeliverable?: boolean;
  }>({ loading: false, error: null });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ loading: true, error: null });
    const result = await setByPincode(pincode.trim());
    if (result.ok) {
      setPincode("");
      setStatus({ loading: false, error: null });
      setOpen(false);
    } else {
      setStatus({ loading: false, error: result.message, ...(result.notDeliverable && { notDeliverable: true }) });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setStatus({ loading: false, error: null });
      }}
    >
      <PopoverTrigger asChild>
        {variant === "desktop" ? (
          <button
            type="button"
            className="ml-3 hidden items-center gap-2 border-l border-border pl-5 text-left text-xs lg:flex"
          >
            <MapPin size={18} className="text-primary" />
            <span>
              <span className="block text-muted-foreground">{prefix}</span>
              <strong className="flex items-center gap-1">
                {location.label} <ChevronDown size={13} />
              </strong>
            </span>
          </button>
        ) : (
          <button type="button" className="flex w-full items-center gap-1.5 text-left text-xs">
            <MapPin size={15} className="shrink-0 text-primary" />
            <span className="text-muted-foreground">{prefix}</span>
            <strong className="min-w-0 truncate">{location.label}</strong>
            <ChevronDown size={13} className="shrink-0" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-3">
        <p className="text-sm font-semibold">Check delivery to your area</p>
        <form onSubmit={submit} className="mt-2 flex gap-1.5">
          <input
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (status.error) setStatus({ loading: false, error: null });
            }}
            placeholder="Enter your pincode"
            aria-label="Pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
          />
          <Button type="submit" disabled={status.loading || pincode.length !== 6}>
            {status.loading ? "…" : "Check"}
          </Button>
        </form>
        {status.notDeliverable ? (
          <div role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-destructive">
              <X size={14} className="shrink-0" /> Not deliverable to this location
            </p>
            <p className="mt-1 text-foreground/80">
              We deliver cakes within 15 km of Marthandam. You can still order for pickup from one of
              our shops below, and Party Essentials ship anywhere in India.
            </p>
          </div>
        ) : (
          status.error && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {status.error}
            </p>
          )
        )}
        <p className="mt-3 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
          Or pick up from one of our shops
        </p>
        <ul className="mt-1.5 space-y-1">
          {BRANCH_LOCATIONS.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                onClick={() => {
                  setBranch(shop.id);
                  setOpen(false);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left transition hover:bg-muted ${
                  location.id === shop.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="block text-sm font-medium">{shop.label}</span>
                <span className="block text-xs text-muted-foreground">{shop.address}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center" aria-label="Cake Stories home">
      <img
        src="/cake-stories-logo-sm.webp"
        alt="Cake Stories"
        width={300}
        height={146}
        className="h-9 w-auto sm:h-11"
      />
    </Link>
  );
}

export function SiteHeader({
  activeCategory,
  defaultQuery = "",
  hideCategories = false,
}: {
  activeCategory?: string;
  defaultQuery?: string;
  /** Hides the category icon row — used on pages (like /login) where it's just clutter. */
  hideCategories?: boolean;
}) {
  const [query, setQuery] = useState(defaultQuery);
  // `defaultQuery` only sets the *initial* value of this input — without
  // this, clearing the search on the homepage (e.g. its "See all cakes"
  // button) left the header box still showing the old term even though the
  // results below had already reset.
  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user } = useAuth();
  const settings = useStoreSettings();
  // Categories come from the database now (so the shop owner can rename or
  // add one from /manage), but we render the last-known static list
  // immediately so the nav never flashes empty while this loads.
  const { data: categories = staticCategories.map((c) => ({ slug: c.slug, name: c.label })) } =
    useQuery({
      queryKey: ["categories"],
      queryFn: getCategories,
      staleTime: 60_000,
    });

  const runSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    setDesktopSearchOpen(false);
    setMobileSearchOpen(false);
    navigate({ to: "/search", search: { q: trimmed } });
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch(query);
  };

  const pickRecentSearch = (term: string) => {
    setQuery(term);
    runSearch(term);
  };

  return (
    <>
      {settings.announcementActive && (
        <div className="bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground sm:text-sm">
          {settings.announcementText}
          {settings.announcementCouponCode && (
            <>
              {" "}
              · Use code{" "}
              <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-bold tracking-wide">
                {settings.announcementCouponCode}
              </span>
            </>
          )}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu size={21} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto">
              <SheetTitle className="font-display text-xl">Menu</SheetTitle>
              <nav className="mt-5 flex flex-col gap-1 text-sm" aria-label="Mobile menu">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shop
                </p>
                {categories.map(({ slug, name }) => (
                  <SheetClose asChild key={slug}>
                    <Link
                      to="/category/$categorySlug"
                      params={{ categorySlug: slug }}
                      className={`rounded-md px-2 py-2 font-medium hover:bg-muted ${activeCategory === slug ? "text-primary" : ""}`}
                    >
                      {name}
                    </Link>
                  </SheetClose>
                ))}
                <p className="mt-4 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  You
                </p>
                <SheetClose asChild>
                  <Link
                    to={user ? "/account" : "/login"}
                    className="rounded-md px-2 py-2 font-medium hover:bg-muted"
                  >
                    {user ? "My account & orders" : "Sign in"}
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/wishlist" className="rounded-md px-2 py-2 font-medium hover:bg-muted">
                    Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ""}
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/cart" className="rounded-md px-2 py-2 font-medium hover:bg-muted">
                    Cart{itemCount > 0 ? ` (${itemCount})` : ""}
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
          <Logo />
          <DeliveryLocationPicker variant="desktop" />
          <form
            onSubmit={submitSearch}
            className="relative ml-auto hidden w-full max-w-xl md:block"
          >
            <label className="relative block">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setDesktopSearchOpen(true)}
                onBlur={() => setDesktopSearchOpen(false)}
                className="h-11 w-full rounded-md border border-input bg-muted/50 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-ring/20"
                placeholder="Search for cakes, flavours and occasions"
              />
            </label>
            {desktopSearchOpen && !query.trim() && (
              <SearchDropdown
                categories={categories}
                onNavigate={() => setDesktopSearchOpen(false)}
                onPickRecent={pickRecentSearch}
              />
            )}
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-1">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label={user ? "My account" : "Sign in"}
              asChild
            >
              <Link to={user ? "/account" : "/login"}>
                <UserRound size={20} />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden sm:inline-flex"
              aria-label={`Wishlist with ${wishlistCount} items`}
              asChild
            >
              <Link to="/wishlist">
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={`Shopping bag with ${itemCount} items`}
              asChild
            >
              <Link to="/cart">
                <ShoppingBag size={21} />
                {itemCount > 0 && (
                  <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>
        <form
          onSubmit={submitSearch}
          className="relative border-t border-border px-4 py-2 md:hidden"
        >
          <label className="relative block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={17}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setMobileSearchOpen(true)}
              onBlur={() => setMobileSearchOpen(false)}
              className="h-10 w-full rounded-md bg-muted pl-10 pr-3 text-sm outline-none"
              placeholder="Search cakes"
            />
          </label>
          {mobileSearchOpen && !query.trim() && (
            <SearchDropdown
              categories={categories}
              onNavigate={() => setMobileSearchOpen(false)}
              onPickRecent={pickRecentSearch}
            />
          )}
        </form>
        <div className="border-t border-border px-4 py-2 lg:hidden">
          <DeliveryLocationPicker variant="mobile" />
        </div>
      </header>

      {!hideCategories && (
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <nav
          className="scrollbar-none flex snap-x gap-3 overflow-x-auto border-b border-border py-4"
          aria-label="Cake categories"
        >
          {categories.map(({ slug, name }) => {
            const icon = CATEGORY_ICONS[slug];
            return (
              <Link
                key={slug}
                to="/category/$categorySlug"
                params={{ categorySlug: slug }}
                className={`flex min-w-36 flex-1 snap-start flex-col items-center gap-2 rounded-md px-4 py-4 text-center text-xs font-semibold transition sm:text-sm ${
                  activeCategory === slug
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-accent"
                }`}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    className={`h-6 w-6 object-contain ${activeCategory === slug ? "brightness-0 invert" : ""}`}
                  />
                ) : (
                  <CakeSlice size={23} />
                )}
                <span className="line-clamp-2 leading-tight">{name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      )}
    </>
  );
}
