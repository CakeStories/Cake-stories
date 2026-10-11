import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading a page as soon as a link is touched (phones) or hovered
    // (desktop), so it's usually ready by the time the tap/click completes.
    defaultPreload: "intent",
    // Keep that preloaded data, and data for pages already visited, for a
    // while instead of refetching it — going back is instant.
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 60_000,
  });

  return router;
};
