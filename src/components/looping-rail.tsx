import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** How many times the list is shown in a row before the rail ends. */
const COPIES = 3;

/**
 * A horizontal rail that shows its items three times in a row, so a short
 * list still fills the row (three cakes in a row built for five looks broken)
 * and gives a bit more to scroll through — then it ends. The arrows hide at
 * either end.
 *
 * `renderItem` gets `duplicate: true` for the repeats, so callers can keep
 * them out of the keyboard tab order.
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
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEnds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  // Back to the first item when the list (or selected tab) changes.
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = 0;
    updateEnds();
  }, [resetKey, items.length, updateEnds]);

  // The row's width can settle after the first render (fonts, layout), so re-check the ends then too.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEnds);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, updateEnds]);

  if (items.length === 0) return null;

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
        onScroll={updateEnds}
        className={`scrollbar-none flex snap-x overflow-x-auto ${trackClassName}`}
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          items.map((item) => (
            <div
              key={`${copy}-${getKey(item)}`}
              className="shrink-0 snap-start"
              aria-hidden={copy !== 0 || undefined}
            >
              {renderItem(item, copy !== 0)}
            </div>
          )),
        )}
      </div>
      {!atStart && (
        <button
          type="button"
          aria-label={previousLabel}
          onClick={() => scrollByPage(-1)}
          className={`${arrow} left-2 ${arrowClassName}`}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          aria-label={nextLabel}
          onClick={() => scrollByPage(1)}
          className={`${arrow} right-2 ${arrowClassName}`}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
