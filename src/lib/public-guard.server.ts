/**
 * Guards for the server functions anyone can call (checkout, coupons, the
 * newsletter): a per-visitor rate limit against spam and guessing, and
 * customer-safe error messages that never reveal database or payment
 * provider internals. Server-only.
 */

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

// Per server instance, which is enough to blunt scripted abuse without a database round trip.
const hits = new Map<string, number[]>();

/**
 * Allows at most `max` calls per `windowMs` for this visitor and `action`;
 * beyond that the call is refused with a friendly "slow down" message.
 */
export async function rateLimit(action: string, max: number, windowMs: number): Promise<void> {
  const key = `${action}:${await clientIp()}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new Error("You're doing that a bit too often — please wait a minute and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
}

/** Messages that come from our own checks are meant for the customer; anything else is internal. */
const INTERNAL_ERROR =
  /Supabase request failed|Razorpay|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|\(\d{3}\)|[{}<>]|undefined|null/i;

/**
 * Runs a public handler; an internal failure (database, payment provider,
 * network) is logged on the server and the customer sees a plain message instead.
 */
export async function customerSafe<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message && !INTERNAL_ERROR.test(message)) throw error;
    console.error(error);
    throw new Error("Something went wrong on our side — please try again in a moment.");
  }
}
