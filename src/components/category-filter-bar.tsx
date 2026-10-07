import { useState } from "react";
import { ArrowDownAZ, ChevronDown, SlidersHorizontal, X } from "lucide-react";

export const SORT_OPTIONS = [
  "Popular",
  "Price: Low to High",
  "Price: High to Low",
  "Name: A to Z",
  "Name: Z to A",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PRICE_BANDS = [
  { id: "u500", label: "Under ₹500", min: 0, max: 500 },
  { id: "500-1000", label: "₹500 – ₹1,000", min: 500, max: 1000 },
  { id: "1000-2000", label: "₹1,000 – ₹2,000", min: 1000, max: 2000 },
  { id: "2000+", label: "Above ₹2,000", min: 2000, max: Infinity },
] as const;

/** Flavour chips: label shown to the customer, and the words that mark a cake as that flavour. */
const FLAVOUR_KEYWORDS: { label: string; words: string[] }[] = [
  { label: "Chocolate", words: ["chocolate", "choco", "truffle", "brownie", "nutella", "chocolaty"] },
  { label: "Red Velvet", words: ["red velvet"] },
  { label: "Black Forest", words: ["black forest"] },
  { label: "White Forest", words: ["white forest"] },
  { label: "Butterscotch", words: ["butterscotch"] },
  { label: "Strawberry", words: ["strawberry"] },
  { label: "Pineapple", words: ["pineapple"] },
  { label: "Mango", words: ["mango"] },
  { label: "Kiwi", words: ["kiwi"] },
  { label: "Blueberry", words: ["blueberry"] },
  { label: "Black Currant", words: ["black currant"] },
  { label: "Rasamalai", words: ["rasamalai"] },
  { label: "Vancho", words: ["vancho"] },
  { label: "Cheesecake", words: ["cheesecake", "cheese cake"] },
  { label: "Nutty", words: ["nutty", "pistachio", "almond", "honey"] },
  { label: "Biscoff", words: ["biscoff"] },
];

export type FilterState = {
  sort: SortOption;
  flavours: string[];
  priceBand: string | null;
};

export const DEFAULT_FILTERS: FilterState = { sort: "Popular", flavours: [], priceBand: null };

type Accessors<T> = {
  name: (item: T) => string;
  price: (item: T) => number;
  /** Actual flavour names on the cake, when it has them (wedding/kids/generic). */
  flavours?: (item: T) => string[];
};

function matchesFlavour(label: string, haystack: string): boolean {
  const entry = FLAVOUR_KEYWORDS.find((f) => f.label === label);
  return !!entry && entry.words.some((w) => haystack.includes(w));
}

function haystackFor<T>(item: T, acc: Accessors<T>): string {
  return [acc.name(item), ...(acc.flavours?.(item) ?? [])].join(" | ").toLowerCase().replace(/[-_]/g, " ");
}

/** Flavour chips worth showing: only those at least one cake in this category matches. */
export function availableFlavours<T>(items: T[], acc: Accessors<T>): string[] {
  const haystacks = items.map((item) => haystackFor(item, acc));
  return FLAVOUR_KEYWORDS.filter((f) => haystacks.some((h) => f.words.some((w) => h.includes(w)))).map(
    (f) => f.label,
  );
}

export function availablePriceBands<T>(items: T[], acc: Accessors<T>) {
  return PRICE_BANDS.filter((band) =>
    items.some((item) => {
      const p = acc.price(item);
      return p >= band.min && p < band.max;
    }),
  );
}

/** Applies the customer's filters, then sorts. `popular` is the category's own default ordering. */
export function applyFilters<T>(
  items: T[],
  state: FilterState,
  acc: Accessors<T>,
  popular: (a: T, b: T) => number,
): T[] {
  const band = PRICE_BANDS.find((b) => b.id === state.priceBand);
  const filtered = items.filter((item) => {
    if (state.flavours.length > 0) {
      const h = haystackFor(item, acc);
      if (!state.flavours.some((label) => matchesFlavour(label, h))) return false;
    }
    if (band) {
      const p = acc.price(item);
      if (p < band.min || p >= band.max) return false;
    }
    return true;
  });

  const byName = (a: T, b: T) => acc.name(a).localeCompare(acc.name(b));
  return [...filtered].sort((a, b) => {
    switch (state.sort) {
      case "Price: Low to High":
        return acc.price(a) - acc.price(b);
      case "Price: High to Low":
        return acc.price(b) - acc.price(a);
      case "Name: A to Z":
        return byName(a, b);
      case "Name: Z to A":
        return byName(b, a);
      default:
        return popular(a, b);
    }
  });
}

export function CategoryFilterBar({
  state,
  onChange,
  flavourOptions,
  priceOptions,
  shown,
  total,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
  flavourOptions: string[];
  priceOptions: readonly { id: string; label: string }[];
  shown: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = state.flavours.length + (state.priceBand ? 1 : 0);
  const hasFilters = activeCount > 0;

  const toggleFlavour = (label: string) =>
    onChange({
      ...state,
      flavours: state.flavours.includes(label)
        ? state.flavours.filter((f) => f !== label)
        : [...state.flavours, label],
    });

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-[13px] ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background hover:border-primary/50"
    }`;

  const canFilter = flavourOptions.length > 0 || priceOptions.length > 0;

  return (
    <div id="sort" className="scroll-mt-24 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        {canFilter && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-semibold transition ${
              open || hasFilters ? "border-primary text-primary" : "border-input hover:border-primary/50"
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasFilters && (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </button>
        )}

        <label className="relative">
          <span className="sr-only">Sort cakes</span>
          <ArrowDownAZ
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <select
            value={state.sort}
            onChange={(e) => onChange({ ...state, sort: e.target.value as SortOption })}
            className="h-10 appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          />
        </label>

      </div>

      {open && canFilter && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {flavourOptions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Flavour
              </p>
              <div className="flex flex-wrap gap-2">
                {flavourOptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={state.flavours.includes(label)}
                    onClick={() => toggleFlavour(label)}
                    className={chip(state.flavours.includes(label))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {priceOptions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Price
              </p>
              <div className="flex flex-wrap gap-2">
                {priceOptions.map((band) => (
                  <button
                    key={band.id}
                    type="button"
                    aria-pressed={state.priceBand === band.id}
                    onClick={() =>
                      onChange({ ...state, priceBand: state.priceBand === band.id ? null : band.id })
                    }
                    className={chip(state.priceBand === band.id)}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state.flavours.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleFlavour(label)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {label} <X size={12} />
            </button>
          ))}
          {state.priceBand && (
            <button
              type="button"
              onClick={() => onChange({ ...state, priceBand: null })}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {PRICE_BANDS.find((b) => b.id === state.priceBand)?.label} <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...state, flavours: [], priceBand: null })}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
