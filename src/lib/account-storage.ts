import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/lib/auth";

/**
 * A list saved in localStorage separately for each signed-in account, plus one
 * "guest" list for when nobody is signed in — so on a shared device, signing
 * out and into another account never shows the previous person's items.
 *
 * - Signed out: the guest list.
 * - Signing in: anything added as a guest is merged into that account's list
 *   (so "add a cake, then sign in at checkout" keeps the cake), and the guest
 *   list is emptied.
 * - Signing out: the account's list stays saved for next time; the page
 *   switches to the (empty) guest list.
 *
 * Nothing is shown until the saved session has been checked, so the first
 * render always matches the server's (empty) render.
 */
export function useAccountScopedList<T extends { id: string }>({
  baseKey,
  legacyKey,
  isValid,
  merge,
}: {
  /** e.g. "cake-stories:cart" — stored as `${baseKey}:guest` / `${baseKey}:user:<id>`. */
  baseKey: string;
  /** Older unscoped key; its contents are adopted once as the guest list. */
  legacyKey?: string;
  isValid: (value: unknown) => value is T;
  /** Combines an account's saved list with the guest list at sign-in. */
  merge: (account: T[], guest: T[]) => T[];
}): { items: T[]; setItems: Dispatch<SetStateAction<T[]>> } {
  const { user, loading } = useAuth();
  // undefined = still checking the saved session; null = signed out.
  const owner = loading ? undefined : (user?.id ?? null);

  const [state, setState] = useState<{ owner: string | null | undefined; items: T[] }>({
    owner: undefined,
    items: [],
  });

  const guestKey = `${baseKey}:guest`;
  const keyFor = (id: string | null) => (id === null ? guestKey : `${baseKey}:user:${id}`);

  useEffect(() => {
    if (owner === undefined) return;

    if (legacyKey) adoptLegacyList(legacyKey, guestKey);

    const guest = readList(guestKey, isValid);
    if (owner === null) {
      setState({ owner, items: guest });
      return;
    }

    const account = readList(keyFor(owner), isValid);
    if (guest.length === 0) {
      setState({ owner, items: account });
      return;
    }
    const merged = merge(account, guest);
    writeList(keyFor(owner), merged);
    removeList(guestKey);
    setState({ owner, items: merged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  // Save under whoever the list belongs to — and only once it has actually
  // been loaded for the current owner, so one account's items are never
  // written into another's slot during a switch.
  useEffect(() => {
    if (state.owner === undefined || state.owner !== owner) return;
    writeList(keyFor(state.owner), state.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const current = state.owner !== undefined && state.owner === owner;

  const setItems: Dispatch<SetStateAction<T[]>> = (update) => {
    setState((prev) => {
      if (prev.owner === undefined) return prev; // not loaded yet
      const items = typeof update === "function" ? update(prev.items) : update;
      return items === prev.items ? prev : { owner: prev.owner, items };
    });
  };

  return { items: current ? state.items : [], setItems };
}

function readList<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, items: unknown[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

function removeList(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

/** Moves a list saved by an older version (one shared list per browser) into the guest slot, once. */
function adoptLegacyList(legacyKey: string, guestKey: string) {
  try {
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return;
    if (window.localStorage.getItem(guestKey) === null)
      window.localStorage.setItem(guestKey, legacy);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // ignore storage errors
  }
}
