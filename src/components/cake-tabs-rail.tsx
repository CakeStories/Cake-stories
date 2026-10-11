import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LoopingRail } from "@/components/looping-rail";
import { useStoreSettings, withSitewideDiscount } from "@/lib/store-settings";
import { onProductImageError } from "@/lib/image-fallback";
import { responsiveImage } from "@/lib/supabase";

export type TabbedCake = {
  id: string;
  href: string;
  image: string;
  title: string;
  badge: string | null;
  minPrice: number;
  minPriceMrp?: number;
  deliveryEstimate: string | null;
  outOfStock: boolean;
  /** Which tab this cake belongs to — set per-product from /manage. Not shown if blank. */
  tabGroup: string | null;
};

type Group = { label: string; cakes: TabbedCake[] };

/** A small emoji for each tab, picked from words in its (admin-editable) name. */
function tabIcon(label: string): string {
  const l = label.toLowerCase();
  if (/choc|cocoa|truffle/.test(l)) return "🍫";
  if (/fruit|berry|mango|pine|straw/.test(l)) return "🍓";
  if (/best|top|popular|trend/.test(l)) return "⭐";
  if (/nut|pista|almond/.test(l)) return "🥜";
  if (/christmas|festive/.test(l)) return "🎄";
  if (/classic|timeless|favourite|favorite/.test(l)) return "🎂";
  return "🍰";
}

/** "17.4" for 17.4%, "17" for exactly 17% — matches the reference design. */
function discountLabel(price: number, mrp?: number | null): string | null {
  if (!mrp || mrp <= price) return null;
  const pct = ((mrp - price) / mrp) * 100;
  return `${Number(pct.toFixed(1))}%`;
}

function RailCard({ cake, duplicate = false }: { cake: TabbedCake; duplicate?: boolean }) {
  const settings = useStoreSettings();
  const shown = withSitewideDiscount(cake.minPrice, cake.minPriceMrp, settings);
  const off = discountLabel(shown.price, shown.mrp);

  return (
    <Link
      to={cake.href}
      {...(duplicate && { tabIndex: -1 })}
      className="group block w-[170px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm transition hover:shadow-md sm:w-[200px] lg:w-[218px]"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          {...responsiveImage(cake.image, 240, "220px")}
          alt={cake.title}
          loading="lazy"
          onError={onProductImageError}
          className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
            cake.outOfStock ? "opacity-50" : ""
          }`}
        />
        {cake.badge && !cake.outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow">
            {cake.badge}
          </span>
        )}
        {cake.outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1 text-center text-[11px] font-semibold text-background">
            Currently unavailable
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="truncate text-[13px] font-medium text-foreground">{cake.title}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <strong className="text-[15px] font-bold">
            {shown.price > 0 ? `₹${shown.price}` : "Price on request"}
          </strong>
          {off && shown.price > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground line-through">₹{shown.mrp}</span>
              <span className="text-[11px] font-semibold text-success">{off}OFF</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

/**
 * A row of named tabs (e.g. "Timeless Favourites", "Chocolate Obsession") —
 * each one a horizontally-scrolling rail of cakes with a next/previous arrow.
 * Tab names and which cakes fall under each are both set from /manage: the
 * tab order comes from Store Settings' "Birthday Cake Tabs" list, and each
 * cake's tab is set on its own product edit form. Cakes with no tab set don't
 * appear here at all — they only show in the regular grid below.
 */
export function CakeTabsRail({
  cakes,
  tabOrder,
  ariaLabel = "Shop by flavour",
  icon = tabIcon,
}: {
  /** Kept for call-site compatibility; the reference design shows no heading. */
  title?: string;
  cakes: TabbedCake[];
  tabOrder: string[];
  /** Accessible name for the section, e.g. "Shop by character". */
  ariaLabel?: string;
  /** Emoji shown beside each tab name; defaults to one picked from flavour words. */
  icon?: (tabLabel: string) => string;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byLabel = new Map<string, TabbedCake[]>();
    for (const cake of cakes) {
      const label = cake.tabGroup?.trim();
      if (!label) continue;
      const list = byLabel.get(label) ?? [];
      list.push(cake);
      byLabel.set(label, list);
    }
    if (byLabel.size === 0) return [];

    // Configured tabs first, in the admin's chosen order; anything used on a
    // product but missing from that list still shows, appended alphabetically,
    // so a forgotten tab never silently disappears.
    const ordered: Group[] = [];
    const seen = new Set<string>();
    for (const label of tabOrder) {
      const list = byLabel.get(label);
      if (list && list.length > 0) {
        ordered.push({ label, cakes: list });
        seen.add(label);
      }
    }
    const leftovers = [...byLabel.keys()].filter((label) => !seen.has(label)).sort();
    for (const label of leftovers) {
      ordered.push({ label, cakes: byLabel.get(label)! });
    }
    return ordered;
  }, [cakes, tabOrder]);

  const activeGroup = groups.find((g) => g.label === activeTab) ?? groups[0];

  if (groups.length === 0 || !activeGroup) return null;

  return (
    <section className="mt-6" aria-label={ariaLabel}>
      <div role="tablist" className="scrollbar-none flex overflow-x-auto">
        {groups.map((group) => {
          const active = group.label === activeGroup.label;
          return (
            <button
              key={group.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(group.label)}
              className={`flex min-w-[150px] flex-1 shrink-0 items-center justify-center gap-2.5 whitespace-nowrap px-4 py-4 text-sm transition sm:text-[15px] ${
                active
                  ? "rounded-t-xl border-t-[3px] border-foreground bg-primary/[0.07] font-semibold text-foreground"
                  : "bg-background font-bold text-foreground/90 hover:bg-primary/[0.03]"
              }`}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                {icon(group.label)}
              </span>
              <span aria-hidden="true" className="h-5 w-px bg-border" />
              {group.label}
            </button>
          );
        })}
      </div>

      <div className="bg-primary/[0.07] px-3 py-5 sm:px-4">
        <LoopingRail
          items={activeGroup.cakes}
          getKey={(cake) => cake.id}
          resetKey={activeGroup.label}
          trackClassName="gap-3 pb-1 sm:gap-4"
          previousLabel="Previous cakes"
          nextLabel="Next cakes"
          renderItem={(cake, duplicate) => <RailCard cake={cake} duplicate={duplicate} />}
        />
      </div>
    </section>
  );
}
