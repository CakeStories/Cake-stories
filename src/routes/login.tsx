import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  // Only same-site paths are accepted, so a crafted link can't bounce a
  // freshly signed-in customer to another website.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search["redirect"];
    return typeof redirect === "string" && redirect.startsWith("/") && !/^\/[/\\]/.test(redirect)
      ? { redirect }
      : {};
  },
  head: () => ({ meta: [{ title: "Sign In | Cake Stories" }, { name: "robots", content: "noindex" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogle, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "busy" | "sent">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: redirect ?? "/account" });
    }
  }, [loading, user, redirect, navigate]);

  // Supabase only allows one confirmation email per address every ~60s, so
  // keep the button disabled client-side too rather than letting every click
  // hit the server and surface a rate-limit error.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    setResendState("busy");
    setResendError(null);
    try {
      await resendConfirmation(email);
      setResendState("sent");
      setResendCooldown(60);
    } catch (err) {
      setResendState("idle");
      setResendError(err instanceof Error ? err.message : "Couldn't resend the email.");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        void navigate({ to: redirect ?? "/account" });
      } else {
        const result = await signUp(email, password);
        if (result.needsEmailConfirmation) {
          setConfirmationSent(true);
        } else {
          void navigate({ to: redirect ?? "/account" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      // Someone who signed up but never confirmed lands here on sign-in —
      // send them to the same "resend" screen instead of a dead-end error.
      if (mode === "signin" && /not confirmed/i.test(message)) {
        setConfirmationSent(true);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader hideCategories />

      <div className="mx-auto max-w-sm px-4 py-16 lg:px-6">
        <h1 className="font-display text-3xl">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to track your orders."
            : "Save your details and track every order."}
        </p>

        {confirmationSent ? (
          <div className="mt-8 rounded-md border border-border bg-card p-5 text-sm">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-muted-foreground">
              We've sent a confirmation link to <strong>{email}</strong>. Click it, then come back
              and sign in.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Didn't get it? Check spam first — confirmation emails can take a few minutes, and some
              inboxes filter them.
            </p>

            {resendError && (
              <p
                role="alert"
                className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {resendError}
              </p>
            )}
            {resendState === "sent" && resendCooldown > 0 && (
              <p className="mt-2 text-xs text-success">Sent again — check your inbox.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={resendState === "busy" || resendCooldown > 0}
                onClick={() => void handleResend()}
              >
                {resendState === "busy" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  "Resend confirmation email"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setMode("signin")}>
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-8 w-full gap-2.5"
              onClick={() => signInWithGoogle(redirect)}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Please wait…
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => setMode("signup")}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline">
            Continue browsing without signing in
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5C29.7 34.8 27 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C39.9 37.5 44 31.7 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
