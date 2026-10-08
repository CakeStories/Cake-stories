/**
 * Small Supabase REST client used by the storefront.
 *
 * We intentionally use the public/publishable key from VITE_* here.
 * Never put a Supabase service-role key in this file or in browser code.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function getSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
  }

  const directUrl = SUPABASE_URL.replace(/\/$/, "");
  // In the browser, go through our own domain's /sb proxy (see vite.config.ts):
  // Indian ISPs block *.supabase.co, so direct requests from phones there fail.
  const url = typeof window === "undefined" ? directUrl : `${window.location.origin}/sb`;
  return { url, directUrl, key: SUPABASE_ANON_KEY };
}

const SUPABASE_STORAGE_PREFIX = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//;

/**
 * Rewrites a Supabase Storage URL (as saved in the database) to go through
 * the /sb proxy on our own domain, so images load where supabase.co is
 * blocked. Anything else is returned unchanged.
 */
export function proxiedImageUrl(url: string): string {
  return url.replace(SUPABASE_STORAGE_PREFIX, "/sb/storage/");
}

/** Applies proxiedImageUrl to every string in fetched rows, including nested ones. */
function proxyStorageUrls<T>(value: T): T {
  if (typeof value === "string") return proxiedImageUrl(value) as T;
  if (Array.isArray(value)) return value.map(proxyStorageUrls) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, proxyStorageUrls(v)]),
    ) as T;
  }
  return value;
}

type QueryOptions = {
  select: string;
  filters?: Record<string, string>;
  order?: string;
};

const PAGE_SIZE = 1000;

/**
 * Fetches every row matching a PostgREST query, not just the first page.
 *
 * By default, a Postgres/Supabase project only returns up to a fixed number
 * of rows per request (commonly 1000) — asking for more doesn't error, it
 * just quietly hands back the first page and stops. That's invisible right
 * up until a category or listing grows past that many rows, at which point
 * whatever came after row 1000 just isn't there — e.g. a kids-cakes
 * category with 112 products worth of flavour/size combinations produces
 * ~3,000 variant rows, so two-thirds of them were being silently dropped,
 * which is exactly why some cakes showed no price, flavour or size: the
 * page they'd have appeared on was simply never fetched.
 *
 * This requests pages explicitly (`Range: 0-999`, `1000-1999`, ...) and
 * keeps going until a page comes back smaller than a full page — so it
 * always retrieves the complete result, however large.
 */
async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const results: T[] = [];
  let start = 0;

  while (true) {
    const response = await fetch(url, {
      headers: { ...headers, Range: `${start}-${start + PAGE_SIZE - 1}` },
    });

    // A 416 on the very first page just means the table/filter matched
    // nothing at all — treat that as an empty result, not an error.
    if (response.status === 416 && start === 0) break;

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${body}`);
    }

    const page = proxyStorageUrls((await response.json()) as T[]);
    results.push(...page);

    if (page.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return results;
}

export async function supabaseRest<T>(table: string, options: QueryOptions): Promise<T[]> {
  const { url, key } = getSupabaseConfig();
  const params = new URLSearchParams({ select: options.select });

  for (const [column, value] of Object.entries(options.filters ?? {})) {
    params.set(column, value);
  }

  if (options.order) params.set("order", options.order);

  return fetchAllPages<T>(`${url}/rest/v1/${table}?${params.toString()}`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

/**
 * Fetches rows from `table` filtered by the category of the product each row
 * belongs to, via `table.product_id -> products.id -> products.category_id`.
 *
 * Filtering this way — a join, done server-side by PostgREST — avoids ever
 * having to pass a giant `in.(id1,id2,...,id200)` list of product IDs in
 * the URL. That approach works for a handful of products, but a category
 * with 100+ products (each a 36-character UUID) produces a URL well past
 * what many servers and proxies will accept, and the request silently
 * fails — which is exactly the kind of "this category just stopped
 * working" bug a growing catalogue would eventually hit.
 */
export async function supabaseRestByCategory<T>(
  table: string,
  categoryId: string,
  options: { select: string; extraFilters?: Record<string, string>; order?: string },
): Promise<T[]> {
  return supabaseRestByProductFilter<T>(table, { "products.category_id": `eq.${categoryId}` }, options);
}

/**
 * Same join-based approach as {@link supabaseRestByCategory}, but for cases
 * that need more than a single `category_id = X` match on the parent
 * product — e.g. "belongs to this category OR was cross-listed into it via
 * product_category_links". Pass the embedded-resource filter(s) directly
 * (keys prefixed `products.`, PostgREST operator syntax for the values).
 */
export async function supabaseRestByProductFilter<T>(
  table: string,
  productFilters: Record<string, string>,
  options: { select: string; extraFilters?: Record<string, string>; order?: string },
): Promise<T[]> {
  const { url, key } = getSupabaseConfig();
  const params = new URLSearchParams({ select: `${options.select},products!inner(category_id)` });

  for (const [column, value] of Object.entries(productFilters)) {
    params.set(column, value);
  }
  for (const [column, value] of Object.entries(options.extraFilters ?? {})) {
    params.set(column, value);
  }

  if (options.order) params.set("order", options.order);

  return fetchAllPages<T>(`${url}/rest/v1/${table}?${params.toString()}`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

/**
 * Fetches every product in a category — its own products.category_id, PLUS
 * any cross-listed into it via product_category_links (the shop owner's
 * "also show this in..." admin control). The primary set uses the safe
 * join-based category fetch above; cross-listed products are normally a
 * short, manually-curated list, so a small `in.(...)` lookup for just
 * those is fine.
 */
export async function fetchProductsForCategory<P extends { id: string }>(
  categoryId: string,
  select: string,
  extraFilters?: Record<string, string>,
): Promise<{ products: P[]; crossListedIds: string[] }> {
  const primary = await supabaseRest<P>("products", {
    select,
    filters: { category_id: `eq.${categoryId}`, ...(extraFilters ?? {}) },
    order: "name.asc",
  });

  const links = await supabaseRest<{ product_id: string }>("product_category_links", {
    select: "product_id",
    filters: { category_id: `eq.${categoryId}` },
  });

  const primaryIds = new Set(primary.map((p) => p.id));
  const crossListedIds = [...new Set(links.map((l) => l.product_id))].filter((id) => !primaryIds.has(id));

  if (crossListedIds.length === 0) {
    return { products: primary, crossListedIds: [] };
  }

  const crossListed = await supabaseRest<P>("products", {
    select,
    filters: { id: `in.(${crossListedIds.join(",")})`, ...(extraFilters ?? {}) },
  });

  return { products: [...primary, ...crossListed], crossListedIds };
}

/**
 * Companion to {@link fetchProductsForCategory}: fetches child rows (variants,
 * images) for every product resolved above — the bulk primary-category set
 * via the safe join, plus the short cross-listed set via a small `in.(...)`.
 */
export async function fetchRowsForCategoryProducts<T>(
  table: string,
  categoryId: string,
  crossListedProductIds: string[],
  select: string,
  extraFilters?: Record<string, string>,
  order?: string,
): Promise<T[]> {
  const [primaryRows, crossListedRows] = await Promise.all([
    supabaseRestByCategory<T>(table, categoryId, { select, extraFilters, order }),
    crossListedProductIds.length > 0
      ? supabaseRest<T>(table, {
          select,
          filters: { product_id: `in.(${crossListedProductIds.join(",")})`, ...(extraFilters ?? {}) },
          order,
        })
      : Promise.resolve([] as T[]),
  ]);
  return [...primaryRows, ...crossListedRows];
}

/**
 * Like `supabaseRest`, but authenticated as the current customer (their own
 * access token) rather than the shared anon key — used for anything gated by
 * a "users can only see their own rows" RLS policy, such as order history.
 */
export async function supabaseRestAsUser<T>(
  table: string,
  accessToken: string,
  options: QueryOptions,
): Promise<T[]> {
  const { url, key } = getSupabaseConfig();
  const params = new URLSearchParams({ select: options.select });

  for (const [column, value] of Object.entries(options.filters ?? {})) {
    params.set(column, value);
  }

  if (options.order) params.set("order", options.order);

  return fetchAllPages<T>(`${url}/rest/v1/${table}?${params.toString()}`, {
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
  });
}

/** Insert rows as the current customer, so RLS's `auth.uid() = user_id` check applies. */
export async function supabaseInsertAsUser<T>(
  table: string,
  accessToken: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
): Promise<T[]> {
  const { url, key } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase insert failed (${response.status}) for ${table}: ${body}`);
  }

  return (await response.json()) as T[];
}
