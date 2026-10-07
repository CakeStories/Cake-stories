import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAccountScopedList } from "@/lib/account-storage";

export type WishlistItem = {
  id: string; // unique per item — the product's href works well (e.g. "/birthday-cake/bf001")
  name: string;
  image: string;
  price: number;
  mrp?: number;
  href: string;
};

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  has: (id: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const STORAGE_KEY = "cake-stories:wishlist";

function isWishlistItem(value: unknown): value is WishlistItem {
  const item = value as WishlistItem;
  return (
    typeof item?.id === "string" && typeof item.name === "string" && typeof item.href === "string"
  );
}

/** At sign-in, favourites saved as a guest are added to the account's list (no duplicates). */
function mergeWishlists(account: WishlistItem[], guest: WishlistItem[]): WishlistItem[] {
  const ids = new Set(account.map((i) => i.id));
  return [...account, ...guest.filter((i) => !ids.has(i.id))];
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  // Saved separately per account (and for guests) — see account-storage.ts.
  // It starts empty on the first render so it matches the server's output.
  const { items, setItems } = useAccountScopedList<WishlistItem>({
    baseKey: STORAGE_KEY,
    legacyKey: STORAGE_KEY,
    isValid: isWishlistItem,
    merge: mergeWishlists,
  });

  const has = (id: string) => items.some((i) => i.id === id);

  const toggle = (item: WishlistItem) => {
    setItems((current) => {
      if (current.some((i) => i.id === item.id)) {
        return current.filter((i) => i.id !== item.id);
      }
      return [...current, item];
    });
  };

  const remove = (id: string) => {
    setItems((current) => current.filter((i) => i.id !== id));
  };

  const clear = () => setItems([]);

  const count = useMemo(() => items.length, [items]);

  const value: WishlistContextValue = { items, count, has, toggle, remove, clear };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
