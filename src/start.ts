import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Public pages are the same for everyone (sign-in and the cart load in the
 * browser), so let Vercel's CDN serve a cached copy: fresh for 60 s, then a
 * slightly stale copy for up to 10 min while it re-renders in the background.
 * Admin edits show up within a minute or so. Personal pages are never cached.
 */
const PRIVATE_PATHS = ["/manage", "/checkout", "/account", "/login", "/cart", "/wishlist"];

const pageCacheMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  const { response } = result;
  const { pathname } = new URL(request.url);
  const isPrivate = PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (
    request.method === "GET" &&
    response.status === 200 &&
    !isPrivate &&
    (response.headers.get("content-type") ?? "").includes("text/html") &&
    !response.headers.has("cache-control")
  ) {
    try {
      response.headers.set("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
    } catch {
      // Immutable headers on this response — skip caching rather than fail the page.
    }
  }
  return result;
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, pageCacheMiddleware, csrfMiddleware],
}));
