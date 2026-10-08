import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getSupabaseConfig } from "@/lib/supabase";

/**
 * Customer authentication.
 *
 * This talks to Supabase's Auth REST API directly (POST /auth/v1/*) rather
 * than adding the @supabase/supabase-js SDK, matching the lightweight REST
 * approach already used in src/lib/supabase.ts. The session (access token,
 * refresh token, expiry, user) lives in localStorage and is refreshed
 * automatically before it expires.
 *
 * This is entirely separate from the admin login in src/lib/admin.server.ts
 * — that's a single shared password for the shop owner; this is real
 * per-customer accounts backed by Supabase Auth + RLS.
 */

export type AuthUser = { id: string; email: string };

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  /** Resolves the user's Authorization value, refreshing the token first if it's about to expire. Null if signed out. */
  getAccessToken: () => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Sends the browser to Google, which sends it back with the session in the URL — see the hash-parsing effect below. */
  signInWithGoogle: (redirectPath?: string) => void;
  signOut: () => Promise<void>;
  /** Re-sends the signup confirmation email. Supabase rate-limits this to once every ~60s per address. */
  resendConfirmation: (email: string) => Promise<void>;
  /** Set if a Google sign-in redirect landed back here without a usable session — e.g. Supabase rejected the redirect URL. */
  oauthError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "cake-stories:auth-session";
const OAUTH_REDIRECT_KEY = "cake-stories:oauth-redirect";
const REFRESH_MARGIN_MS = 60_000; // refresh if less than a minute of life left

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

async function authFetch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      (data.error_description as string | undefined) ??
      (data.msg as string | undefined) ??
      (data.error as string | undefined) ??
      "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data;
}

function toSession(data: Record<string, unknown>): StoredSession | null {
  const accessToken = data.access_token as string | undefined;
  const refreshToken = data.refresh_token as string | undefined;
  const expiresIn = data.expires_in as number | undefined;
  const rawUser = data.user as Record<string, unknown> | undefined;

  if (!accessToken || !refreshToken || !rawUser?.id) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
    user: { id: rawUser.id as string, email: (rawUser.email as string) ?? "" },
  };
}

/**
 * After Google sign-in, Supabase redirects back to the site's home page with
 * the session in the URL fragment (`#access_token=...&refresh_token=...`)
 * rather than as a query string or response body — that's the "implicit"
 * OAuth flow, and it's how Supabase's hosted /authorize endpoint works
 * without needing a server-side callback route. The fragment never reaches
 * the server, so this has to be read client-side. AuthProvider wraps the
 * whole app, so this works no matter which page the hash lands on.
 */
function readOAuthHash(): { accessToken: string; refreshToken: string; expiresIn: number } | null {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    expiresIn: Number(params.get("expires_in")) || 3600,
  };
}

/** Supabase reports a failed OAuth redirect (e.g. Google denied, or the redirect URL isn't allow-listed) as `#error=...&error_description=...`. */
function readOAuthHashError(): string | null {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const description = params.get("error_description");
  const error = params.get("error");
  if (!description && !error) return null;
  return (description ?? error ?? "Google sign-in failed.").replace(/\+/g, " ");
}

/** The hash flow gives us tokens but not the user record — fetch it separately. */
async function sessionFromOAuthTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<StoredSession | null> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!response.ok) return null;
  const user = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!user?.id) return null;
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: { id: user.id as string, email: (user.email as string) ?? "" },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start signed-out on every render pass, including the client's first
  // (hydrating) one — same reasoning as cart.tsx/wishlist.tsx. The
  // bootstrap effect below already re-derives the real session from
  // localStorage right after mount; reading it here too just meant the
  // client's first render disagreed with the server's.
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const navigate = useNavigate();

  // On mount, make sure a stored session is still valid (or refresh it).
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const oauthHashError = readOAuthHashError();
      const oauthTokens = readOAuthHash();
      if (oauthHashError || oauthTokens) {
        // Strip the tokens/error from the URL immediately — they're
        // sensitive and this hash is the kind of thing that ends up in
        // browser history.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      if (oauthHashError) {
        if (!cancelled) {
          setOauthError(oauthHashError);
          setLoading(false);
        }
        return;
      }

      if (oauthTokens) {
        try {
          const oauthSession = await sessionFromOAuthTokens(oauthTokens);
          if (!cancelled) {
            if (oauthSession) {
              setSession(oauthSession);
              writeStoredSession(oauthSession);
              setLoading(false);
              // The redirect back from Google lands on whichever page we told
              // Supabase to send it to (the site root, to keep that URL as
              // plain as possible for the allow-list) — if the customer was
              // actually headed somewhere else, send them on from here.
              let redirectPath: string | null = null;
              try {
                redirectPath = window.sessionStorage.getItem(OAUTH_REDIRECT_KEY);
                window.sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
              } catch {
                // ignore storage errors
              }
              if (redirectPath && redirectPath !== window.location.pathname) {
                void navigate({ to: redirectPath });
              }
              return;
            }
            setOauthError("Google sign-in didn't complete. Please try again.");
            setLoading(false);
          }
          return;
        } catch {
          if (!cancelled) {
            setOauthError("Google sign-in didn't complete. Please try again.");
            setLoading(false);
          }
          return;
        }
      }

      const stored = readStoredSession();
      if (!stored) {
        setLoading(false);
        return;
      }
      if (stored.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
        if (!cancelled) {
          setSession(stored);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await authFetch("token?grant_type=refresh_token", { refresh_token: stored.refreshToken });
        const refreshed = toSession(data);
        if (!cancelled) {
          setSession(refreshed);
          writeStoredSession(refreshed);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          writeStoredSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const getAccessToken = async (): Promise<string | null> => {
    if (!session) return null;
    if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken;

    try {
      const data = await authFetch("token?grant_type=refresh_token", { refresh_token: session.refreshToken });
      const refreshed = toSession(data);
      setSession(refreshed);
      writeStoredSession(refreshed);
      return refreshed?.accessToken ?? null;
    } catch {
      setSession(null);
      writeStoredSession(null);
      return null;
    }
  };

  const signUp = async (email: string, password: string) => {
    const data = await authFetch("signup", { email, password });
    const newSession = toSession(data);
    if (newSession) {
      setSession(newSession);
      writeStoredSession(newSession);
      return { needsEmailConfirmation: false };
    }
    // Supabase returns a user with no session when email confirmation is required.
    return { needsEmailConfirmation: true };
  };

  const signIn = async (email: string, password: string) => {
    const data = await authFetch("token?grant_type=password", { email, password });
    const newSession = toSession(data);
    if (!newSession) throw new Error("Couldn't sign in. Please try again.");
    setSession(newSession);
    writeStoredSession(newSession);
  };

  const signInWithGoogle = (redirectPath?: string) => {
    // A full-page OAuth redirect: Google returns to Supabase's own callback
    // URL, so this uses the direct project URL rather than the /sb proxy.
    const { directUrl: url, key } = getSupabaseConfig();
    // `redirect_to` has to exactly match an entry in Supabase's Auth →
    // URL Configuration → Redirect URLs allow-list, or Supabase silently
    // drops back to its default Site URL without the tokens — which looks
    // exactly like "Google sign-in did nothing". A bare origin (no path, no
    // query string) is the one URL that's *always* on that list, because
    // it's the Site URL itself, so that's what we send here. Where the
    // customer actually wanted to end up is remembered separately (not
    // encoded in the URL) and picked back up once the session lands — see
    // the bootstrap effect above.
    try {
      if (redirectPath) window.sessionStorage.setItem(OAUTH_REDIRECT_KEY, redirectPath);
      else window.sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
    } catch {
      // ignore storage errors
    }
    const authorizeUrl = new URL(`${url}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", window.location.origin);
    authorizeUrl.searchParams.set("apikey", key);
    window.location.href = authorizeUrl.toString();
  };

  const resendConfirmation = async (email: string) => {
    await authFetch("resend", { type: "signup", email });
  };

  const signOut = async () => {
    const token = session?.accessToken;
    setSession(null);
    writeStoredSession(null);
    if (!token) return;
    try {
      const { url, key } = getSupabaseConfig();
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      });
    } catch {
      // Session is already cleared locally; a failed remote logout isn't worth surfacing.
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      loading,
      getAccessToken,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resendConfirmation,
      oauthError,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, loading, oauthError],
  );

  return (
    <AuthContext.Provider value={value}>
      {oauthError && (
        <div
          role="alert"
          className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-destructive px-4 py-2 text-sm text-destructive-foreground"
        >
          <span>{oauthError}</span>
          <button
            type="button"
            onClick={() => setOauthError(null)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
