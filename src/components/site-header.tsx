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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { categories as staticCategories } from "@/lib/catalog";
import { getCategories } from "@/lib/categories";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useStoreSettings } from "@/lib/store-settings";
import { BRANCH_LOCATIONS, useDeliveryLocation } from "@/lib/delivery-location";
import { flavours } from "@/lib/flavour-list";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/recent-searches";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/sheet";
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

export function Logo() {
  return (
    <Link to="/" className="flex items-center" aria-label="Cake Stories home">
      <img src="/cake-stories-logo.webp" alt="Cake Stories" className="h-9 w-auto sm:h-11" />
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
  const { location, setBranch, setByPincode } = useDeliveryLocation();
  const [pincodeInput, setPincodeInput] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const submitPincode = async (event: React.FormEvent) => {
    event.preventDefault();
    setPincodeStatus({ loading: true, error: null });
    const result = await setByPincode(pincodeInput.trim());
    if (result.ok) {
      setPincodeInput("");
      setPincodeStatus({ loading: false, error: null });
    } else {
      setPincodeStatus({ loading: false, error: result.message });
    }
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-3 hidden items-center gap-2 border-l border-border pl-5 text-left text-xs lg:flex">
                <MapPin size={18} className="text-primary" />
                <span>
                  <span className="block text-muted-foreground">Delivering to</span>
                  <strong className="flex items-center gap-1">
                    {location.label} <ChevronDown size={13} />
                  </strong>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Delivering to</DropdownMenuLabel>
              <div className="px-2 py-1.5">
                <form onSubmit={submitPincode} className="flex gap-1.5">
                  <input
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter your pincode"
                    inputMode="numeric"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pincodeStatus.loading || pincodeInput.length !== 6}
                  >
                    {pincodeStatus.loading ? "…" : "Go"}
                  </Button>
                </form>
                {pincodeStatus.error && (
                  <p className="mt-1 text-xs text-destructive">{pincodeStatus.error}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Or pick one of our locations</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={location.id} onValueChange={setBranch}>
                {BRANCH_LOCATIONS.map((loc) => (
                  <DropdownMenuRadioItem
                    key={loc.id}
                    value={loc.id}
                    className="flex-col items-start gap-0"
                  >
                    <span className="font-medium">{loc.label}</span>
                    <span className="text-xs text-muted-foreground">{loc.address}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
