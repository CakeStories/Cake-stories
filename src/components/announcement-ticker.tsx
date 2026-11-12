import { useEffect, useRef, useState, type ReactNode } from "react";

/** Scroll speed in pixels per second — the same for short and long messages. */
const SPEED = 45;

/**
 * The announcement strip's text, gliding left to right in a seamless loop.
 * The message is repeated as often as the screen needs so the strip is never
 * half empty, and re-measured whenever the text (or screen width) changes —
 * so editing the announcement can't leave gaps or a jump in the loop.
 *
 * It stands still (centred, wrapping) while the website editor is open, for
 * visitors who ask their device for reduced motion, and until it has been
 * measured in the browser.
 */
export function AnnouncementTicker({ children, still = false }: { children: ReactNode; still?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  // copies = how many messages make up half the moving strip; 0 = standing still.
  const [layout, setLayout] = useState({ copies: 0, itemWidth: 0 });

  useEffect(() => {
    if (still) {
      setLayout({ copies: 0, itemWidth: 0 });
      return;
    }
    const box = boxRef.current;
    const item = measureRef.current;
    if (!box || !item) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const measure = () => {
      const itemWidth = item.getBoundingClientRect().width;
      if (reduceMotion.matches || itemWidth <= 0) {
        setLayout({ copies: 0, itemWidth: 0 });
        return;
      }
      // Each half must be at least as wide as the strip, so the loop never shows a gap.
      const copies = Math.ceil(box.clientWidth / itemWidth) + 1;
      setLayout((prev) =>
        prev.copies === copies && Math.abs(prev.itemWidth - itemWidth) < 0.5 ? prev : { copies, itemWidth },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(item);
    reduceMotion.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      reduceMotion.removeEventListener("change", measure);
    };
  }, [still]);

  const message = (
    <>
      {children}
      <span aria-hidden="true" className="px-6 opacity-60">
        ✦
      </span>
    </>
  );

  return (
    <div ref={boxRef} className="relative overflow-hidden">
      {layout.copies === 0 ? (
        <div className="px-4 text-center">{children}</div>
      ) : (
        <div
          className="announcement-ticker flex w-max"
          style={{ animationDuration: `${(layout.copies * layout.itemWidth) / SPEED}s` }}
        >
          {[0, 1].map((half) => (
            <div key={half} className="flex" aria-hidden={half === 1 || undefined}>
              {Array.from({ length: layout.copies }, (_, i) => (
                <span key={i} className="whitespace-nowrap" aria-hidden={half === 1 || i > 0 || undefined}>
                  {message}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {/* One copy, out of sight, to measure the message's width. */}
      {!still && (
        <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap">
          {message}
        </span>
      )}
    </div>
  );
}
