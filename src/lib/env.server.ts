import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Server-only environment variable reader.
 *
 * Vite only injects `VITE_`-prefixed variables into the app. Non-prefixed
 * secrets (ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_SECRET, …)
 * are *sometimes* present on `process.env` depending on how the server is
 * started — under `vite dev` they usually are not, which makes a correctly
 * configured `.env` look like a missing one.
 *
 * This reads `process.env` first, and falls back to parsing the `.env` files
 * from disk once, cached. In production (where the host sets real environment
 * variables) the fallback never runs.
 *
 * Values are trimmed, so a stray trailing space or CRLF in `.env` won't
 * silently break a password comparison.
 */
let fileEnvCache: Record<string, string> | null = null;

function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Strip matching surrounding quotes, if present.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    if (key) result[key] = value;
  }

  return result;
}

function loadFileEnv(): Record<string, string> {
  if (fileEnvCache) return fileEnvCache;

  fileEnvCache = {};

  try {
    // Later files win, matching Vite's own precedence.
    for (const name of [".env", ".env.local"]) {
      try {
        const contents = readFileSync(resolve(process.cwd(), name), "utf8");
        fileEnvCache = { ...fileEnvCache, ...parseEnvFile(contents) };
      } catch {
        // File doesn't exist — that's fine.
      }
    }
  } catch {
    // Not running in Node (or fs unavailable) — fall back to process.env only.
  }

  return fileEnvCache;
}

/** Read a server-side environment variable, or `undefined` if unset. */
export function serverEnv(key: string): string | undefined {
  const fromProcess = process.env?.[key];
  if (fromProcess !== undefined && fromProcess !== "") return fromProcess.trim();

  const fromFile = loadFileEnv()[key];
  if (fromFile !== undefined && fromFile !== "") return fromFile;

  return undefined;
}

/** Read a required env var, throwing a clear, actionable error if it's missing. */
export function requireServerEnv(key: string): string {
  const value = serverEnv(key);
  if (!value) {
    throw new Error(
      `Missing server environment variable ${key}. Add it to your .env file (see .env.example), ` +
        `then restart the dev server. In production, set it in your host's environment settings.`,
    );
  }
  return value;
}
