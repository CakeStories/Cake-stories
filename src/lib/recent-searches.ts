/**
 * Recent search terms, kept per-browser in localStorage (not per-account —
 * there's no server-side search history table, and this is just a
 * convenience shortcut like every storefront's search box has).
 */

const STORAGE_KEY = "cake-stories:recent-searches";
const MAX_ENTRIES = 8;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(terms: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

/** Adds a term to the front of the list, de-duping case-insensitively and capping the length. */
export function addRecentSearch(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return getRecentSearches();
  const existing = getRecentSearches().filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...existing].slice(0, MAX_ENTRIES);
  writeRecentSearches(next);
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const next = getRecentSearches().filter((t) => t.toLowerCase() !== term.toLowerCase());
  writeRecentSearches(next);
  return next;
}

export function clearRecentSearches(): string[] {
  writeRecentSearches([]);
  return [];
}
