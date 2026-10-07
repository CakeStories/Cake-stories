import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireServerEnv, serverEnv } from "@/lib/env.server";
import { serviceRest as adminRest, uploadImage } from "@/lib/service.server";
import { findSuccessfulPayment, markOrderPaid } from "@/lib/payments.server";

/**
 * Server-only admin data layer.
 *
 * Everything in this file runs on the server. It uses the Supabase
 * SERVICE ROLE key, which bypasses RLS and can write to any table — it must
 * NEVER be prefixed with VITE_ or imported into client-side code paths that
 * would leak it into the browser bundle.
 *
 * Required server env vars (see .env.example):
 *   SUPABASE_URL                 — same project URL as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Project Settings > API > service_role secret
 *   ADMIN_PASSWORD               — the password the shop owner types to sign in
 *   ADMIN_SESSION_SECRET         — any long random string, used to sign tokens
 *   ADMIN_URL_TOKEN              — the secret /manage/<token> path segment
 */

/* ---------------------------------------------------------------- auth --- */

// A signed, time-limited token so the password isn't re-sent on every action.
// Format: `${expiresAt}.${hmac(expiresAt)}`.
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

async function signToken(expiresAt: number): Promise<string> {
  const secret = requireServerEnv("ADMIN_SESSION_SECRET");

  const { createHmac } = await import("node:crypto");
  const signature = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${signature}`;
}

async function assertValidToken(token: string): Promise<void> {
  const [rawExpiry, signature] = token.split(".");
  const expiresAt = Number(rawExpiry);

  if (!Number.isFinite(expiresAt) || !signature)
    throw new Error("Your session is invalid. Sign in again.");
  if (Date.now() > expiresAt) throw new Error("Your session expired. Sign in again.");

  const expected = await signToken(expiresAt);
  if (!(await safeEqual(expected, token))) {
    throw new Error("Your session is invalid. Sign in again.");
  }
}

/** Constant-time string comparison that doesn't leak the length of either value. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

/** True if `candidate` is the configured ADMIN_URL_TOKEN. Fails closed when it isn't configured. */
async function isAdminUrlToken(candidate: string): Promise<boolean> {
  const expected = serverEnv("ADMIN_URL_TOKEN");
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

// Failed sign-in attempts per client IP. In-memory, so it's per server
// instance — combined with the secret URL token and the fixed delay below,
// that's enough to make guessing the password impractical.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const failedLogins = new Map<string, { count: number; firstAt: number }>();

async function clientIp(): Promise<string> {
  try {
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    return (
      getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown"
    );
  } catch {
    return "unknown";
  }
}

function recentFailures(ip: string): number {
  const entry = failedLogins.get(ip);
  if (!entry) return 0;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failedLogins.delete(ip);
    return 0;
  }
  return entry.count;
}

function recordFailure(ip: string) {
  const entry = failedLogins.get(ip);
  if (entry && Date.now() - entry.firstAt <= LOGIN_WINDOW_MS) entry.count += 1;
  else failedLogins.set(ip, { count: 1, firstAt: Date.now() });
  // Keep the map from growing without bound.
  if (failedLogins.size > 10_000) failedLogins.clear();
}

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ password: z.string().min(1).max(200), urlToken: z.string().max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    // The secret URL segment is required here too — without it this function
    // would be a password-guessing endpoint anyone could call directly.
    if (!(await isAdminUrlToken(data.urlToken))) throw new Error("Not found.");

    const ip = await clientIp();
    if (recentFailures(ip) >= MAX_FAILED_LOGINS) {
      throw new Error("Too many wrong passwords. Wait 15 minutes, then try again.");
    }

    // Surfaces a clear "missing env var" message rather than a generic
    // "wrong password" when the server simply isn't configured.
    const expected = requireServerEnv("ADMIN_PASSWORD");
    requireServerEnv("ADMIN_SESSION_SECRET");

    // Compare the typed password trimmed, so a trailing newline pasted into
    // .env (or a stray space) doesn't cause a confusing "wrong password".
    if (!(await safeEqual(data.password.trim(), expected))) {
      recordFailure(ip);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw new Error("That password isn't right.");
    }

    failedLogins.delete(ip);
    return { token: await signToken(Date.now() + SESSION_TTL_MS) };
  });

/**
 * Gatekeeper for the secret admin URL segment (see ADMIN_URL_TOKEN in
 * .env.example). Checked server-side so the real token never has to be
 * shipped to the browser for comparison — a wrong guess just gets a plain
 * 404, with nothing in the response to suggest an admin page exists at all.
 */
export const adminVerifyUrlToken = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ candidate: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => ({ ok: await isAdminUrlToken(data.candidate) }));

/**
 * Reports which admin env vars the server can actually see, without ever
 * revealing their values. Only answers callers who know the secret URL.
 */
export const adminCheckConfig = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ urlToken: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    if (!(await isAdminUrlToken(data.urlToken))) throw new Error("Not found.");
    return {
      SUPABASE_URL: Boolean(serverEnv("SUPABASE_URL") ?? serverEnv("VITE_SUPABASE_URL")),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(serverEnv("SUPABASE_SERVICE_ROLE_KEY")),
      ADMIN_PASSWORD: Boolean(serverEnv("ADMIN_PASSWORD")),
      ADMIN_SESSION_SECRET: Boolean(serverEnv("ADMIN_SESSION_SECRET")),
      RAZORPAY_KEY_ID: Boolean(serverEnv("RAZORPAY_KEY_ID")),
      RAZORPAY_KEY_SECRET: Boolean(serverEnv("RAZORPAY_KEY_SECRET")),
    };
  });

/* -------------------------------------------------------------- orders --- */

export const ORDER_STATUSES = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type AdminOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_address: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  fulfillment_type: "delivery" | "pickup";
  pickup_branch: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  subtotal: number;
  delivery_charge: number;
  discount_amount: number;
  coupon_code: string | null;
  total: number;
  payment_status: string;
  order_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  order_items: Array<{
    product_name: string;
    size: string | null;
    flavour: string | null;
    quantity: number;
    unit_price: number;
    customization: { note?: string; instructions?: string } | null;
  }>;
};

export const adminListOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ token: z.string(), payment: z.enum(["paid", "pending", "all"]).default("paid") })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const paymentFilter = data.payment === "all" ? "" : `&payment_status=eq.${data.payment}`;
    const rows = await adminRest<AdminOrder[]>(
      "orders?select=id,created_at,customer_name,customer_email,customer_phone,delivery_address,delivery_date,delivery_time,fulfillment_type,pickup_branch,delivery_lat,delivery_lng,subtotal,delivery_charge,discount_amount,coupon_code,total,payment_status,order_status,razorpay_order_id,razorpay_payment_id,order_items(product_name,size,flavour,quantity,unit_price,customization)" +
        `${paymentFilter}&order=created_at.desc&limit=200`,
    );
    return rows.map((row) => ({
      ...row,
      subtotal: Number(row.subtotal),
      delivery_charge: Number(row.delivery_charge),
      discount_amount: Number(row.discount_amount),
      total: Number(row.total),
      order_items: row.order_items.map((item) => ({
        ...item,
        unit_price: Number(item.unit_price),
      })),
    }));
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        orderId: z.string().uuid(),
        orderStatus: z.enum(ORDER_STATUSES),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    // Unpaid orders can't be progressed — there's nothing to bake yet.
    const updated = await adminRest<Array<{ id: string }>>(
      `orders?id=eq.${data.orderId}&payment_status=eq.paid`,
      {
        method: "PATCH",
        body: { order_status: data.orderStatus, updated_at: new Date().toISOString() },
      },
    );
    if (updated.length === 0) throw new Error("Only paid orders can be updated.");
    return { updated: true };
  });

/**
 * For an order still marked "awaiting payment": asks Razorpay whether it was
 * actually paid (e.g. the customer closed the tab before we heard back) and,
 * if so, marks it paid.
 */
export const adminCheckOrderPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), orderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const [order] = await adminRest<
      Array<{ razorpay_order_id: string | null; payment_status: string }>
    >(`orders?select=razorpay_order_id,payment_status&id=eq.${data.orderId}&limit=1`);
    if (!order?.razorpay_order_id) throw new Error("This order has no Razorpay order.");
    if (order.payment_status === "paid") return { paid: true };

    const paymentId = await findSuccessfulPayment(order.razorpay_order_id);
    if (!paymentId) return { paid: false };
    await markOrderPaid(order.razorpay_order_id, paymentId);
    return { paid: true };
  });

/* ------------------------------------------------------------- reading --- */

export type AdminVariant = {
  id: string;
  size: string | null;
  flavour: string | null;
  price: number;
  mrp: number | null;
  active: boolean;
};

export type AdminProduct = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  delivery_estimate: string | null;
  tab_group: string | null;
  active: boolean;
  out_of_stock: boolean;
  variants: AdminVariant[];
  /** Other categories this product is also cross-listed into, besides its primary category_id above. */
  crossListedCategoryIds: string[];
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  banner_text: string | null;
  sort_order: number;
  active: boolean;
};

export const adminGetCatalog = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), categoryId: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const categories = await adminRest<AdminCategory[]>(
      "categories?select=id,name,slug,banner_text,sort_order,active&order=sort_order.asc,name.asc",
    );

    const categoryFilter = data.categoryId ? `&category_id=eq.${data.categoryId}` : "";
    const products = await adminRest<
      Array<
        Omit<AdminProduct, "variants" | "crossListedCategoryIds"> & {
          product_variants: AdminVariant[];
          product_category_links: Array<{ category_id: string }>;
        }
      >
    >(
      `products?select=id,category_id,name,slug,description,image_url,badge,delivery_estimate,tab_group,active,out_of_stock,product_variants(id,size,flavour,price,mrp,active),product_category_links(category_id)${categoryFilter}&order=name.asc`,
    );

    const normalised: AdminProduct[] = products.map((product) => ({
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      image_url: product.image_url,
      badge: product.badge,
      delivery_estimate: product.delivery_estimate,
      tab_group: product.tab_group,
      active: product.active,
      out_of_stock: product.out_of_stock,
      crossListedCategoryIds: (product.product_category_links ?? []).map(
        (link) => link.category_id,
      ),
      variants: (product.product_variants ?? [])
        .map((v) => ({ ...v, price: Number(v.price), mrp: v.mrp === null ? null : Number(v.mrp) }))
        .sort((a, b) => (a.size ?? "").localeCompare(b.size ?? "")),
    }));

    return { categories, products: normalised };
  });

export const adminCreateCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), name: z.string().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const slug = await uniqueSlug("categories", slugify(data.name));
    const latest = await adminRest<Array<{ sort_order: number }>>(
      "categories?select=sort_order&order=sort_order.desc&limit=1",
    );
    const nextOrder = (latest[0]?.sort_order ?? -1) + 1;

    const [category] = await adminRest<Array<{ id: string; slug: string }>>("categories", {
      method: "POST",
      body: { name: data.name, slug, sort_order: nextOrder, active: true },
    });
    if (!category?.id) throw new Error("Category wasn't created.");
    return { created: true, categoryId: category.id, slug: category.slug };
  });

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        categoryId: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        bannerText: z.string().max(300).nullable().optional(),
        sortOrder: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const { token, categoryId, bannerText, sortOrder, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (bannerText !== undefined) patch.banner_text = bannerText;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;
    if (Object.keys(patch).length === 0) return { updated: false };

    await adminRest(`categories?id=eq.${categoryId}`, { method: "PATCH", body: patch });
    return { updated: true };
  });

export const adminAddCategoryLink = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ token: z.string(), productId: z.string().uuid(), categoryId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    // Upsert (on conflict do nothing) so re-adding an existing link is a harmless no-op.
    await adminRest("product_category_links", {
      method: "POST",
      body: { product_id: data.productId, category_id: data.categoryId },
      headers: { Prefer: "resolution=ignore-duplicates" },
    });
    return { added: true };
  });

export const adminRemoveCategoryLink = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ token: z.string(), productId: z.string().uuid(), categoryId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest(
      `product_category_links?product_id=eq.${data.productId}&category_id=eq.${data.categoryId}`,
      { method: "DELETE" },
    );
    return { removed: true };
  });

/* ------------------------------------------------------------- writing --- */

export const adminUpdateVariant = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        variantId: z.string().uuid(),
        price: z.number().nonnegative().optional(),
        mrp: z.number().nonnegative().nullable().optional(),
        size: z.string().max(60).optional(),
        flavour: z.string().max(60).nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const { token, variantId, ...fields } = data;
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return { updated: false };

    await adminRest(`product_variants?id=eq.${variantId}`, { method: "PATCH", body: patch });
    return { updated: true };
  });

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        productId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        badge: z.string().max(40).nullable().optional(),
        delivery_estimate: z.string().max(60).nullable().optional(),
        tab_group: z.string().max(60).nullable().optional(),
        image_url: z.string().url().nullable().optional(),
        active: z.boolean().optional(),
        out_of_stock: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const { token, productId, ...fields } = data;
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return { updated: false };

    await adminRest(`products?id=eq.${productId}`, { method: "PATCH", body: patch });

    if (typeof patch.image_url === "string") await setProductImage(productId, patch.image_url);

    return { updated: true };
  });

/**
 * Keeps the product_images mirror in sync with products.image_url, so the
 * storefront (which reads product_images first) doesn't show a stale picture.
 */
async function setProductImage(productId: string, imageUrl: string) {
  const existing = await adminRest<Array<{ id: string }>>(
    `product_images?select=id&product_id=eq.${productId}&limit=1`,
  );
  if (existing[0]) {
    await adminRest(`product_images?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: { image_url: imageUrl },
    });
  } else {
    await adminRest("product_images", {
      method: "POST",
      body: { product_id: productId, image_url: imageUrl },
    });
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/** Finds a slug that doesn't collide with an existing row in `table`, appending -2, -3, etc. if needed. */
async function uniqueSlug(table: string, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  for (let attempt = 2; attempt <= 20; attempt++) {
    const existing = await adminRest<Array<{ id: string }>>(
      `${table}?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    );
    if (existing.length === 0) return slug;
    slug = `${baseSlug}-${attempt}`;
  }
  return `${baseSlug}-${Date.now()}`;
}

export const adminCreateProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        categoryId: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        badge: z.string().max(40).nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        size: z.string().min(1).max(60),
        price: z.number().nonnegative(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const slug = await uniqueSlug("products", slugify(data.name));

    const [product] = await adminRest<Array<{ id: string }>>("products", {
      method: "POST",
      body: {
        category_id: data.categoryId,
        slug,
        name: data.name,
        description: data.description ?? null,
        badge: data.badge ?? null,
        image_url: data.imageUrl ?? null,
        active: true,
      },
    });
    if (!product?.id) throw new Error("Product wasn't created.");

    await adminRest("product_variants", {
      method: "POST",
      body: { product_id: product.id, size: data.size, price: data.price },
    });

    if (data.imageUrl) await setProductImage(product.id, data.imageUrl);

    return { created: true, productId: product.id, slug };
  });

export const adminAddVariant = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        productId: z.string().uuid(),
        size: z.string().min(1).max(60),
        flavour: z.string().max(60).nullable().optional(),
        price: z.number().nonnegative(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest("product_variants", {
      method: "POST",
      body: {
        product_id: data.productId,
        size: data.size,
        flavour: data.flavour || null,
        price: data.price,
      },
    });
    return { created: true };
  });

export const adminDeleteVariant = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), variantId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest(`product_variants?id=eq.${data.variantId}`, { method: "DELETE" });
    return { deleted: true };
  });

/* --------------------------------------------------------- image upload --- */

// The file is sent as base64 (no multipart parsing needed). ~5 MB of image is
// ~6.7 MB of base64; uploadImage() enforces the real limit on the decoded bytes.
const uploadSchema = {
  token: z.string(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  base64: z.string().min(1).max(7_000_000),
};

export const adminUploadImage = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ ...uploadSchema, productId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const imageUrl = await uploadImage("birthday", data.fileName, data.contentType, data.base64);

    await adminRest(`products?id=eq.${data.productId}`, {
      method: "PATCH",
      body: { image_url: imageUrl },
    });
    await setProductImage(data.productId, imageUrl);

    return { imageUrl };
  });

/* ------------------------------------------------------ homepage banners --- */

export type AdminBanner = {
  id: string;
  label: string;
  image_url: string;
  link_url: string;
  external: boolean;
  sort_order: number;
  active: boolean;
  /** null = homepage banner; otherwise the category page it's shown on. */
  category_id: string | null;
  position: "top" | "bottom";
};

// A banner link is either a path on this site or a full http(s) URL — never
// javascript: or other schemes.
const bannerLink = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => /^\/(?![/\\])/.test(value) || /^https?:\/\//i.test(value), {
    message: "Use a page on this site (starting with /) or a full https:// link.",
  });

export const adminListBanners = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    return adminRest<AdminBanner[]>(
      "banners?select=id,label,image_url,link_url,external,sort_order,active,category_id,position&order=sort_order.asc,created_at.asc",
    );
  });

export const adminCreateBanner = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        label: z.string().max(200).default(""),
        imageUrl: z.string().url(),
        linkUrl: bannerLink.default("/"),
        external: z.boolean().default(false),
        categoryId: z.string().uuid().nullable().default(null),
        position: z.enum(["top", "bottom"]).default("top"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const latest = await adminRest<Array<{ sort_order: number }>>(
      "banners?select=sort_order&order=sort_order.desc&limit=1",
    );
    const nextOrder = (latest[0]?.sort_order ?? -1) + 1;

    const [created] = await adminRest<AdminBanner[]>("banners", {
      method: "POST",
      body: {
        label: data.label,
        image_url: data.imageUrl,
        link_url: data.linkUrl,
        external: data.external,
        sort_order: nextOrder,
        category_id: data.categoryId,
        position: data.position,
      },
    });

    return created;
  });

export const adminUpdateBanner = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        bannerId: z.string().uuid(),
        label: z.string().max(200).optional(),
        linkUrl: bannerLink.optional(),
        external: z.boolean().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        imageUrl: z.string().url().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        position: z.enum(["top", "bottom"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const { token, bannerId, linkUrl, sortOrder, imageUrl, categoryId, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (linkUrl !== undefined) patch.link_url = linkUrl;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;
    if (imageUrl !== undefined) patch.image_url = imageUrl;
    if (categoryId !== undefined) patch.category_id = categoryId;

    if (Object.keys(patch).length === 0) return { updated: false };

    await adminRest(`banners?id=eq.${bannerId}`, { method: "PATCH", body: patch });
    return { updated: true };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), bannerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest(`banners?id=eq.${data.bannerId}`, { method: "DELETE" });
    return { deleted: true };
  });

export const adminUploadBannerImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object(uploadSchema).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    return { imageUrl: await uploadImage("banners", data.fileName, data.contentType, data.base64) };
  });

/* --------------------------------------------------------- store settings --- */

export type AdminStoreSettings = {
  announcement_text: string;
  announcement_coupon_code: string | null;
  announcement_active: boolean;
  sitewide_discount_percent: number | null;
  sitewide_discount_active: boolean;
  birthday_delivery_estimate: string;
  default_delivery_estimate: string;
  birthday_tabs: string[];
};

export const adminGetStoreSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const rows = await adminRest<
      Array<{
        announcement_text: string;
        announcement_coupon_code: string | null;
        announcement_active: boolean;
        sitewide_discount_percent: number | string | null;
        sitewide_discount_active: boolean;
        birthday_delivery_estimate: string | null;
        default_delivery_estimate: string | null;
        birthday_tabs: string[] | null;
      }>
    >(
      "store_settings?select=announcement_text,announcement_coupon_code,announcement_active,sitewide_discount_percent,sitewide_discount_active,birthday_delivery_estimate,default_delivery_estimate,birthday_tabs&limit=1",
    );

    const row = rows[0];
    const settings: AdminStoreSettings = row
      ? {
          announcement_text: row.announcement_text,
          announcement_coupon_code: row.announcement_coupon_code,
          announcement_active: row.announcement_active,
          sitewide_discount_percent:
            row.sitewide_discount_percent != null ? Number(row.sitewide_discount_percent) : null,
          sitewide_discount_active: row.sitewide_discount_active,
          birthday_delivery_estimate: row.birthday_delivery_estimate || "90-120 mins",
          default_delivery_estimate: row.default_delivery_estimate || "24 hours",
          birthday_tabs: Array.isArray(row.birthday_tabs) ? row.birthday_tabs : [],
        }
      : {
          announcement_text: "",
          announcement_coupon_code: null,
          announcement_active: true,
          sitewide_discount_percent: null,
          sitewide_discount_active: false,
          birthday_delivery_estimate: "90-120 mins",
          default_delivery_estimate: "24 hours",
          birthday_tabs: [],
        };

    return settings;
  });

export const adminUpdateStoreSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        announcementText: z.string().max(300).optional(),
        announcementCouponCode: z.string().max(40).nullable().optional(),
        announcementActive: z.boolean().optional(),
        // A null percent always means "no sitewide sale configured"; a sale
        // can never be switched on without one (enforced below).
        sitewideDiscountPercent: z.number().min(1).max(90).nullable().optional(),
        sitewideDiscountActive: z.boolean().optional(),
        birthdayDeliveryEstimate: z.string().max(60).optional(),
        defaultDeliveryEstimate: z.string().max(60).optional(),
        birthdayTabs: z.array(z.string().min(1).max(60)).max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const {
      announcementText,
      announcementCouponCode,
      announcementActive,
      sitewideDiscountPercent,
      sitewideDiscountActive,
      birthdayDeliveryEstimate,
      defaultDeliveryEstimate,
      birthdayTabs,
    } = data;

    const patch: Record<string, unknown> = {};
    if (announcementText !== undefined) patch.announcement_text = announcementText;
    if (announcementCouponCode !== undefined) {
      // Store an empty string as "no coupon" (null), so the storefront's
      // `settings.announcementCouponCode &&` check hides it cleanly.
      patch.announcement_coupon_code = announcementCouponCode?.trim() || null;
    }
    if (announcementActive !== undefined) patch.announcement_active = announcementActive;
    if (sitewideDiscountPercent !== undefined)
      patch.sitewide_discount_percent = sitewideDiscountPercent;
    if (sitewideDiscountActive !== undefined) {
      if (sitewideDiscountActive) {
        // Never allow turning the sale "on" without a percent already set —
        // either in this same call or already saved from before.
        const percentInThisCall = sitewideDiscountPercent;
        if (percentInThisCall === null) {
          throw new Error("Set a discount percentage before starting the sale.");
        }
        if (percentInThisCall === undefined) {
          const current = await adminRest<
            Array<{ sitewide_discount_percent: number | string | null }>
          >("store_settings?select=sitewide_discount_percent&limit=1");
          if (current[0]?.sitewide_discount_percent == null) {
            throw new Error("Set a discount percentage before starting the sale.");
          }
        }
      }
      patch.sitewide_discount_active = sitewideDiscountActive;
    }
    if (birthdayDeliveryEstimate !== undefined) {
      if (!birthdayDeliveryEstimate.trim())
        throw new Error("Enter a delivery estimate for birthday cakes.");
      patch.birthday_delivery_estimate = birthdayDeliveryEstimate.trim();
    }
    if (defaultDeliveryEstimate !== undefined) {
      if (!defaultDeliveryEstimate.trim())
        throw new Error("Enter a default delivery estimate.");
      patch.default_delivery_estimate = defaultDeliveryEstimate.trim();
    }
    if (birthdayTabs !== undefined) {
      patch.birthday_tabs = birthdayTabs.map((t) => t.trim()).filter(Boolean);
    }

    if (Object.keys(patch).length === 0) return { updated: false };

    patch.updated_at = new Date().toISOString();
    await adminRest("store_settings?id=eq.true", { method: "PATCH", body: patch });
    return { updated: true };
  });

/* -------------------------------------------------------------- add-ons --- */

export type AdminAddon = {
  id: string;
  category: string;
  name: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export const adminListAddons = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const rows = await adminRest<Array<Omit<AdminAddon, "price"> & { price: number | string }>>(
      "addons?select=id,category,name,price,image_url,sort_order,active&order=category.asc,sort_order.asc",
    );
    return rows.map((row) => ({ ...row, price: Number(row.price) }));
  });

export const adminCreateAddon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        category: z.string().min(1).max(60),
        name: z.string().min(1).max(200),
        price: z.number().nonnegative(),
        imageUrl: z.string().url().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);

    const latest = await adminRest<Array<{ sort_order: number }>>(
      `addons?select=sort_order&category=eq.${encodeURIComponent(data.category)}&order=sort_order.desc&limit=1`,
    );
    const nextOrder = (latest[0]?.sort_order ?? -1) + 1;

    await adminRest("addons", {
      method: "POST",
      body: {
        category: data.category,
        name: data.name,
        price: data.price,
        image_url: data.imageUrl ?? null,
        sort_order: nextOrder,
      },
    });
    return { created: true };
  });

export const adminUpdateAddon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        addonId: z.string().uuid(),
        category: z.string().min(1).max(60).optional(),
        name: z.string().min(1).max(200).optional(),
        price: z.number().nonnegative().optional(),
        imageUrl: z.string().url().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const { token, addonId, imageUrl, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (imageUrl !== undefined) patch.image_url = imageUrl;
    if (Object.keys(patch).length === 0) return { updated: false };
    await adminRest(`addons?id=eq.${addonId}`, { method: "PATCH", body: patch });
    return { updated: true };
  });

export const adminDeleteAddon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), addonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest(`addons?id=eq.${data.addonId}`, { method: "DELETE" });
    return { deleted: true };
  });

export const adminUploadAddonImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object(uploadSchema).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    return { imageUrl: await uploadImage("addons", data.fileName, data.contentType, data.base64) };
  });

/* -------------------------------------------------------------- coupons --- */

// "amount" = a fixed ₹ amount off (the database's name for it).
export type AdminCoupon = {
  id: string;
  code: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  min_order_amount: number | null;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
};

const MAX_PERCENT_OFF = 90;

export const adminListCoupons = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const rows = await adminRest<
      Array<
        Omit<AdminCoupon, "discount_value" | "min_order_amount"> & {
          discount_value: number | string;
          min_order_amount: number | string | null;
        }
      >
    >(
      "coupons?select=id,code,discount_type,discount_value,min_order_amount,active,expires_at,max_uses,times_used&order=code.asc",
    );
    return rows.map((row) => ({
      ...row,
      discount_value: Number(row.discount_value),
      min_order_amount: row.min_order_amount != null ? Number(row.min_order_amount) : null,
    }));
  });

// Expiry comes from a date picker as YYYY-MM-DD and means "valid through the
// end of that day" in the shop's timezone.
const expiryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform((value) => (value ? `${value}T23:59:59+05:30` : value));

export const adminCreateCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        code: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, - and _ in the code."),
        discountType: z.enum(["percent", "amount"]),
        discountValue: z.number().positive(),
        minOrderAmount: z.number().nonnegative().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        expiresAt: expiryDate,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    if (data.discountType === "percent" && data.discountValue > MAX_PERCENT_OFF) {
      throw new Error(`Percentage discounts must be ${MAX_PERCENT_OFF}% or less.`);
    }
    try {
      await adminRest("coupons", {
        method: "POST",
        body: {
          code: data.code.toUpperCase(),
          discount_type: data.discountType,
          discount_value: data.discountValue,
          min_order_amount: data.minOrderAmount ?? null,
          max_uses: data.maxUses ?? null,
          expires_at: data.expiresAt ?? null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("duplicate key")) throw new Error("That code already exists.");
      throw err;
    }
    return { created: true };
  });

export const adminUpdateCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string(),
        couponId: z.string().uuid(),
        discountType: z.enum(["percent", "amount"]).optional(),
        discountValue: z.number().positive().optional(),
        minOrderAmount: z.number().nonnegative().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        active: z.boolean().optional(),
        expiresAt: expiryDate,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    const { couponId, discountType, discountValue, minOrderAmount, maxUses, expiresAt, active } =
      data;

    // Check the percent cap against the coupon as it will be after this edit,
    // not just the fields sent — e.g. switching ₹500-off to "percent".
    if (discountType !== undefined || discountValue !== undefined) {
      const [current] = await adminRest<
        Array<{ discount_type: string; discount_value: number | string }>
      >(`coupons?select=discount_type,discount_value&id=eq.${couponId}&limit=1`);
      if (!current) throw new Error("That coupon no longer exists.");
      const finalType = discountType ?? current.discount_type;
      const finalValue = discountValue ?? Number(current.discount_value);
      if (finalType === "percent" && finalValue > MAX_PERCENT_OFF) {
        throw new Error(`Percentage discounts must be ${MAX_PERCENT_OFF}% or less.`);
      }
    }

    const patch: Record<string, unknown> = {};
    if (active !== undefined) patch.active = active;
    if (discountType !== undefined) patch.discount_type = discountType;
    if (discountValue !== undefined) patch.discount_value = discountValue;
    if (minOrderAmount !== undefined) patch.min_order_amount = minOrderAmount;
    if (maxUses !== undefined) patch.max_uses = maxUses;
    if (expiresAt !== undefined) patch.expires_at = expiresAt;
    if (Object.keys(patch).length === 0) return { updated: false };
    await adminRest(`coupons?id=eq.${couponId}`, { method: "PATCH", body: patch });
    return { updated: true };
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ token: z.string(), couponId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    await assertValidToken(data.token);
    await adminRest(`coupons?id=eq.${data.couponId}`, { method: "DELETE" });
    return { deleted: true };
  });
