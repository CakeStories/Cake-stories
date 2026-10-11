import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Enough cards that the row is always full and has room to loop in both directions. */
const MIN_RENDERED_ITEMS = 16;

/**
 * A horizontal rail that repeats its items so it never ends half-empty (three
 * cakes in a row built for five looks broken) and scrolls round endlessly:
 * when the customer nears either end it silently jumps back by one copy of
 * the list, which looks identical, so the arrows never run out.
 *
 * `renderItem` gets `duplicate: true` for every copy except one, so callers
 * can keep the repeats out of the keyboard tab order.
 */
export function LoopingRail<T>({
  items,
  getKey,
  renderItem,
  resetKey,
  trackClassName = "",
  arrowClassName = "",
  previousLabel = "Previous",
  nextLabel = "Next",
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, duplicate: boolean) => ReactNode;
  /** Changing this (e.g. the selected tab) scrolls back to the first item. */
  resetKey?: string | undefined;
  trackClassName?: string;
  arrowClassName?: string;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const copies = items.length === 0 ? 0 : Math.max(3, Math.ceil(MIN_RENDERED_ITEMS / items.length));

  /** Width of one full copy of the list, including the gaps between cards. */
  const period = useCallback(() => {
    const el = trackRef.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const nextCopy = el?.children[items.length] as HTMLElement | undefined;
    return first && nextCopy ? nextCopy.offsetLeft - first.offsetLeft : 0;
  }, [items.length]);

  /** If we've drifted into the first or last copy, jump by one copy (looks identical). */
  const recenter = useCallback(() => {
    const el = trackRef.current;
    const p = period();
    if (!el || p <= 0) return;
    if (el.scrollLeft < p * 0.5) el.scrollLeft += p;
    else if (el.scrollLeft + el.clientWidth > el.scrollWidth - p * 0.5) el.scrollLeft -= p;
  }, [period]);

  // Start on the second copy, so there's something to scroll back into.
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = period();
  }, [resetKey, items.length, period]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  if (items.length === 0) return null;

  // Wait until scrolling (including smooth arrow scrolls and snap) settles.
  const onScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(recenter, 150);
  };

  const scrollByPage = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrow =
    "absolute top-[38%] z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-md transition hover:bg-muted";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className={`scrollbar-none flex snap-x overflow-x-auto ${trackClassName}`}
      >
        {Array.from({ length: copies }, (_, copy) =>
          items.map((item) => (
            <div
              key={`${copy}-${getKey(item)}`}
              className="shrink-0 snap-start"
              aria-hidden={copy !== 1 || undefined}
            >
              {renderItem(item, copy !== 1)}
            </div>
          )),
        )}
      </div>
      <button
        type="button"
        aria-label={previousLabel}
        onClick={() => scrollByPage(-1)}
        className={`${arrow} left-2 ${arrowClassName}`}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => scrollByPage(1)}
        className={`${arrow} right-2 ${arrowClassName}`}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
