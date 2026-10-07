import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/button";
import { getAddons, groupAddonsByCategory, type Addon } from "@/lib/addons";
import { cartLineId, useCart } from "@/lib/cart";
import type { CartItemRef } from "@/lib/pricing";

export function ExtraSpecialDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { items, addItem, setQuantity } = useCart();

  useEffect(() => {
    if (!open || addons !== null) return;
    getAddons()
      .then((list) => {
        setAddons(list);
        setActiveCategory((current) => current ?? list[0]?.category ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load extras."));
  }, [open, addons]);

  const grouped = useMemo(() => groupAddonsByCategory(addons ?? []), [addons]);
  const activeGroup = grouped.find((g) => g.category === activeCategory) ?? grouped[0];

  const refFor = (addonId: string): CartItemRef => ({ type: "addon", addonId });
  const lineIdFor = (addonId: string) => cartLineId({ ref: refFor(addonId) });
  const quantityOf = (addonId: string) =>
    items.find((i) => i.id === lineIdFor(addonId))?.quantity ?? 0;

  const addOne = (addon: Addon) => {
    addItem({
      ref: refFor(addon.id),
      name: addon.name,
      image: addon.image ?? "",
      price: addon.price,
      variant: addon.category,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-xl font-normal">
            Make it extra special 🎉
          </DialogTitle>
        </div>

        {grouped.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-b border-border px-5 pt-2">
            {grouped.map((group) => (
              <button
                key={group.category}
                type="button"
                onClick={() => setActiveCategory(group.category)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  activeGroup?.category === group.category
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {group.category}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          {!error && addons === null && (
            <p className="text-sm text-muted-foreground">Loading extras…</p>
          )}

          {!error && addons !== null && addons.length === 0 && (
            <p className="text-sm text-muted-foreground">No extras are available right now.</p>
          )}

          {activeGroup && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activeGroup.items.map((addon) => {
                const qty = quantityOf(addon.id);
                return (
                  <div key={addon.id} className="rounded-md border border-border p-2.5">
                    <div className="aspect-square overflow-hidden rounded-md bg-muted">
                      {addon.image ? (
                        <img
                          src={addon.image}
                          alt={addon.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-2xl">🎂</div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-9 text-xs font-medium">{addon.name}</p>
                    <p className="mt-0.5 text-sm font-semibold">₹{addon.price}</p>

                    {qty === 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => addOne(addon)}
                      >
                        Add
                      </Button>
                    ) : (
                      <div className="mt-2 flex items-center justify-between rounded-md border border-input">
                        <button
                          type="button"
                          aria-label={`Remove one ${addon.name}`}
                          onClick={() => setQuantity(lineIdFor(addon.id), qty - 1)}
                          className="grid size-8 place-items-center hover:bg-muted"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-sm font-semibold">{qty}</span>
                        <button
                          type="button"
                          aria-label={`Add one more ${addon.name}`}
                          onClick={() => addOne(addon)}
                          className="grid size-8 place-items-center hover:bg-muted"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-5 py-3">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
