/** Returns the discount % (rounded) if `mrp` is a genuine markup over `price`, else null. */
export function discountPercent(price: number, mrp?: number | null): number | null {
  if (!mrp || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

const SIZE_CLASSES = {
  sm: { price: "text-sm", mrp: "text-[11px]", badge: "text-[9px] px-1 py-0.5" },
  base: { price: "text-base", mrp: "text-xs", badge: "text-[10px] px-1.5 py-0.5" },
  lg: { price: "text-2xl", mrp: "text-base", badge: "text-xs px-2 py-0.5" },
} as const;

export function PriceTag({
  price,
  mrp,
  size = "base",
}: {
  price: number;
  mrp?: number | null;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const pct = discountPercent(price, mrp);
  const classes = SIZE_CLASSES[size];

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <strong className={classes.price}>₹{price}</strong>
      {pct !== null && (
        <>
          <span className={`${classes.mrp} text-muted-foreground line-through`}>₹{mrp}</span>
          <span className={`${classes.badge} rounded-sm bg-success/15 font-bold uppercase text-success`}>
            {pct}% off
          </span>
        </>
      )}
    </span>
  );
}
