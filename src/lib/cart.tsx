import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CartItemRef } from "@/lib/pricing";
import { useAccountScopedList } from "@/lib/account-storage";

// Each cart line stores a snapshot of what was added (name, image, unit price
// for display, and an optional variant description like "5KG · Black Forest"),
// plus a `ref` saying exactly which product/variant/add-on it is. The price
// shown here is only a preview — at checkout the server re-prices every line
// from its `ref`, so an edited or outdated price in the browser never matters.
export type CartLine = {
  id: string; // unique per line — the item plus its message/instructions
  ref: CartItemRef;
  name: string;
  image: string;
  price: number; // display price; refreshed from the server at checkout
  quantity: number;
  variant?: string; // e.g. "5KG · Black Forest"
  href?: string; // link back to the product/model page
  note?: string; // optional message to write on the cake
  specialInstructions?: string; // optional delivery/handling instructions from the customer
};

type NewLine = Omit<CartLine, "id" | "quantity">;

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (line: NewLine, quantity?: number) => void;
  /** Puts this exact line in the cart with exactly `quantity` (used by "Buy Now", so it never doubles up). */
  setItem: (line: NewLine, quantity: number) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  /** Applies server-checked prices; lines priced `null` are no longer sold and are removed. */
  applyPrices: (prices: Array<{ id: string; price: number | null }>) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "cake-stories:cart";

function refKey(ref: CartItemRef): string {
  if (ref.type === "catalog") return `catalog:${ref.slug}`;
  if (ref.type === "variant") return `variant:${ref.variantId}`;
  return `addon:${ref.addonId}`;
}

/**
 * Two identical cakes with different messages ("Happy Birthday Priya" /
 * "…Arun") are two separate lines, not one line with the second message.
 */
export function cartLineId(line: Pick<CartLine, "ref" | "note" | "specialInstructions">): string {
  const extras = `${line.note ?? ""}\u0000${line.specialInstructions ?? ""}`;
  let hash = 0;
  for (let i = 0; i < extras.length; i++) hash = (Math.imul(31, hash) + extras.charCodeAt(i)) | 0;
  return `${refKey(line.ref)}#${(hash >>> 0).toString(36)}`;
}

function isValidLine(value: unknown): value is CartLine {
  const line = value as CartLine;
  return (
    typeof line?.id === "string" &&
    typeof line.name === "string" &&
    typeof line.price === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    typeof line.ref?.type === "string"
  );
}

/** At sign-in, lines added as a guest join the account's saved cart; the same line's quantities add up. */
function mergeCarts(account: CartLine[], guest: CartLine[]): CartLine[] {
  const merged = [...account];
  for (const line of guest) {
    const index = merged.findIndex((l) => l.id === line.id);
    const existing = merged[index];
    if (existing)
      merged[index] = { ...line, quantity: Math.min(50, existing.quantity + line.quantity) };
    else merged.push(line);
  }
  return merged;
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Saved separately per account (and for guests), so signing out and into
  // another account on the same device never shows someone else's cart.
  // Lines saved by older versions have no `ref` and can't be priced by the
  // server, so isValidLine drops them rather than blocking checkout.
  const { items, setItems } = useAccountScopedList<CartLine>({
    baseKey: STORAGE_KEY,
    legacyKey: STORAGE_KEY,
    isValid: isValidLine,
    merge: mergeCarts,
  });

  const upsert = (line: NewLine, quantity: (existing: number) => number) => {
    const id = cartLineId(line);
    setItems((current) => {
      const existing = current.find((l) => l.id === id);
      if (existing) {
        return current.map((l) =>
          l.id === id ? { ...l, ...line, id, quantity: quantity(l.quantity) } : l,
        );
      }
      return [...current, { ...line, id, quantity: quantity(0) }];
    });
  };

  const addItem = (line: NewLine, quantity = 1) => upsert(line, (existing) => existing + quantity);

  const setItem = (line: NewLine, quantity: number) => upsert(line, () => quantity);

  const removeItem = (id: string) => {
    setItems((current) => current.filter((l) => l.id !== id));
  };

  const setQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((current) => current.map((l) => (l.id === id ? { ...l, quantity } : l)));
  };

  const applyPrices = (prices: Array<{ id: string; price: number | null }>) => {
    const byId = new Map(prices.map((p) => [p.id, p.price]));
    setItems((current) => {
      let changed = false;
      const next = current.flatMap((line) => {
        if (!byId.has(line.id)) return [line];
        const price = byId.get(line.id);
        if (price === null) {
          changed = true;
          return [];
        }
        if (price !== undefined && price !== line.price) {
          changed = true;
          return [{ ...line, price }];
        }
        return [line];
      });
      return changed ? next : current;
    });
  };

  const clear = () => setItems([]);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value: CartContextValue = {
    items,
    itemCount,
    subtotal,
    addItem,
    setItem,
    removeItem,
    setQuantity,
    applyPrices,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
