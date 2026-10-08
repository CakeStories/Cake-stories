// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Indian ISPs (Jio, Airtel, ACT…) DNS-block *.supabase.co, so browsers there
// can't reach Supabase directly. The browser talks to /sb/* on our own domain
// instead, and this forwards it to the real project (see src/lib/supabase.ts).
const supabaseUrl = (
  process.env["VITE_SUPABASE_URL"] ?? loadEnv("production", process.cwd(), "VITE_")["VITE_SUPABASE_URL"]
)?.replace(/\/$/, "");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(supabaseUrl && {
    // Builds: a nitro route rule (on Vercel this becomes an edge rewrite). The
    // Lovable config's types only list a few nitro options, but it passes every
    // option through to nitro at runtime — hence the cast.
    nitro: { routeRules: { "/sb/**": { proxy: `${supabaseUrl}/**` } } } as { preset?: string },
    // `vite dev`: the same forwarding via Vite's dev-server proxy.
    vite: {
      server: {
        proxy: {
          "/sb": {
            target: supabaseUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/sb/, ""),
          },
        },
      },
    },
  }),
});
