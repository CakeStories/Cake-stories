import { serverEnv } from "@/lib/env.server";

/**
 * Server-only Supabase access with the SERVICE ROLE key, which bypasses RLS.
 * Only import this from server-function handlers — never expose it to code
 * that ships to the browser.
 */

export const PRODUCT_IMAGES_BUCKET = "product-images";

export function getServiceConfig() {
  const url = serverEnv("SUPABASE_URL") ?? serverEnv("VITE_SUPABASE_URL");
  const serviceKey = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error(
      "The server isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then restart the dev server.",
    );
  }

  return { url: url.replace(/\/$/, ""), serviceKey };
}

export async function serviceRest<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const { url, serviceKey } = getServiceConfig();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Resolves a customer's Supabase access token to their user id, or null if it isn't valid. */
export async function userIdFromAccessToken(accessToken: string): Promise<string | null> {
  const { url, serviceKey } = getServiceConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a base64-encoded image to the public product-images bucket under
 * `folder/`, and returns its public URL. Only real image types under 5 MB are
 * accepted — anything else (HTML, SVG, huge files) is rejected here, not just
 * in the browser.
 */
export async function uploadImage(
  folder: string,
  fileName: string,
  contentType: string,
  base64: string,
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES[contentType]) {
    throw new Error("Upload a JPG, PNG, WebP, GIF or AVIF image.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("That file is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB.");

  const { url, serviceKey } = getServiceConfig();
  const baseName =
    fileName
      .replace(/\.[^.]*$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .toLowerCase()
      .slice(0, 80) || "image";
  // Timestamped so a replacement shows immediately instead of a cached copy.
  const objectPath = `${folder}/${Date.now()}-${baseName}.${ALLOWED_IMAGE_TYPES[contentType]}`;

  const response = await fetch(`${url}/storage/v1/object/${PRODUCT_IMAGES_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status}): ${await response.text()}`);
  }

  return `${url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${objectPath}`;
}
