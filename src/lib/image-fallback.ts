import type { SyntheticEvent } from "react";

/**
 * Last-resort image for a product with no photo in `product_images` and no
 * `image_url` set — an empty `src=""` renders as a broken image (the browser
 * re-requests the current page), so every cake list/detail page should fall
 * back to this instead of an empty string.
 */
export const DEFAULT_PRODUCT_IMAGE =
  "https://nyigmtugjsktzkietgbc.supabase.co/storage/v1/object/public/product-images/kids/_photo-coming-soon.webp";

/**
 * `<img onError={onProductImageError}>` — if the stored URL 404s or otherwise
 * fails to load (deleted file, bad path, etc.), swap to the placeholder
 * instead of leaving the browser's broken-image icon on screen. Guards
 * against an infinite loop if the placeholder itself ever fails.
 */
export function onProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.src === DEFAULT_PRODUCT_IMAGE) return;
  img.src = DEFAULT_PRODUCT_IMAGE;
}
