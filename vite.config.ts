import { defineConfig, loadEnv, type PluginOption } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Indian ISPs (Jio, Airtel, ACT…) DNS-block *.supabase.co, so browsers there
// can't reach Supabase directly. The browser talks to /sb/* on our own domain
// instead, and this forwards it to the real project (see src/lib/supabase.ts).
const supabaseUrl = (
  process.env["VITE_SUPABASE_URL"] ?? loadEnv("production", process.cwd(), "VITE_")["VITE_SUPABASE_URL"]
)?.replace(/\/$/, "");

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Code under a server/ folder (or importing "server-only") must never reach the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
  ];

  if (command === "build") {
    plugins.push(
      nitro({
        // On Vercel the host is detected automatically; elsewhere the build targets Cloudflare Workers.
        defaultPreset: "cloudflare-module",
        ...(supabaseUrl && {
          // On Vercel these become edge rewrites.
          routeRules: {
            // Resized photos rarely change: let Vercel's CDN keep them for 30 days
            // (each size is transformed by Supabase only once) and browsers for 7.
            "/sb/storage/v1/render/**": {
              proxy: `${supabaseUrl}/storage/v1/render/**`,
              headers: {
                "cache-control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400",
              },
            },
            "/sb/**": { proxy: `${supabaseUrl}/**` },
          },
        }),
      }),
    );
  }

  plugins.push(viteReact());

  // VITE_* values from .env, baked into both the browser and server bundles.
  const define = Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), "VITE_")).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    plugins,
    server: {
      host: "::",
      port: 8080,
      // `vite dev`: the same /sb forwarding via Vite's dev-server proxy.
      ...(supabaseUrl && {
        proxy: {
          "/sb": {
            target: supabaseUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/sb/, ""),
          },
        },
      }),
    },
  };
});
