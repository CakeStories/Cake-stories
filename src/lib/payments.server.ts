import { serverEnv } from "@/lib/env.server";
import { serviceRest } from "@/lib/service.server";
import { sendOrderEmails } from "@/lib/order-emails.server";

/**
 * Server-only Razorpay helpers. RAZORPAY_KEY_SECRET is used here and nowhere
 * else — never move it into a VITE_ variable or client code.
 */

function razorpayKeys() {
  const keyId = serverEnv("RAZORPAY_KEY_ID");
  const keySecret = serverEnv("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error(
      "Payments aren't configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server (see .env.example).",
    );
  }
  return { keyId, keySecret };
}

async function razorpayApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { keyId, keySecret } = razorpayKeys();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    throw new Error(`Razorpay request failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export type PaymentStatus =
  | { state: "missing" }
  | { state: "ok" | "rejected" | "error"; mode: "live" | "test" | "unknown"; keyEnding: string; detail?: string };

/**
 * Whether the server's Razorpay keys work, for the admin panel — asks Razorpay
 * for one order (read-only). Never returns the keys themselves.
 */
export async function checkRazorpayKeys(): Promise<PaymentStatus> {
  const keyId = serverEnv("RAZORPAY_KEY_ID");
  const keySecret = serverEnv("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return { state: "missing" };
  const mode = keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : "unknown";
  const keyEnding = keyId.slice(-4);
  try {
    await razorpayApi("orders?count=1");
    return { state: "ok", mode, keyEnding };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rejected = /\((401|403)\)/.test(message);
    return {
      state: rejected ? "rejected" : "error",
      mode,
      keyEnding,
      detail: rejected
        ? "Razorpay refused these keys — the Key ID and Key Secret don't belong together (e.g. a live ID with a test secret)."
        : message.slice(0, 200),
    };
  }
}

export async function createRazorpayOrder(
  amountInPaise: number,
  receipt: string,
  notes: Record<string, string>,
) {
  const { keyId } = razorpayKeys();
  const order = await razorpayApi<{ id: string; amount: number; currency: string }>("orders", {
    method: "POST",
    body: { amount: amountInPaise, currency: "INR", receipt, notes },
  });
  return { razorpayOrderId: order.id, amount: order.amount, currency: order.currency, keyId };
}

export async function isValidPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const { keySecret } = razorpayKeys();
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = Buffer.from(
    createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex"),
  );
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The first successful (captured or authorized) payment against a Razorpay order, if any. */
export async function findSuccessfulPayment(razorpayOrderId: string): Promise<string | null> {
  const result = await razorpayApi<{ items: Array<{ id: string; status: string }> }>(
    `orders/${encodeURIComponent(razorpayOrderId)}/payments`,
  );
  const paid = result.items.find((p) => p.status === "captured" || p.status === "authorized");
  return paid?.id ?? null;
}

type PendingOrderRow = { id: string; payment_status: string; coupon_code: string | null };

/**
 * Marks the order for `razorpayOrderId` as paid. Idempotent: a second call
 * (e.g. the browser callback and an admin "check payment" both firing) is a
 * no-op, so a coupon use is never counted twice.
 */
export async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ orderId: string }> {
  const [order] = await serviceRest<PendingOrderRow[]>(
    `orders?select=id,payment_status,coupon_code&razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&limit=1`,
  );
  if (!order) throw new Error("We couldn't find that order.");
  if (order.payment_status === "paid") return { orderId: order.id };

  // Only flip rows that are still pending, so concurrent calls can't both win.
  const updated = await serviceRest<Array<{ id: string }>>(
    `orders?id=eq.${order.id}&payment_status=neq.paid`,
    {
      method: "PATCH",
      body: {
        payment_status: "paid",
        order_status: "confirmed",
        razorpay_payment_id: razorpayPaymentId,
        updated_at: new Date().toISOString(),
      },
    },
  );

  if (updated.length > 0 && order.coupon_code) {
    // Counts the use. If the limit was hit between checkout and payment the
    // customer has already paid the discounted price — honour it rather than
    // failing a completed order.
    await serviceRest<boolean>("rpc/use_coupon", {
      method: "POST",
      body: { p_code: order.coupon_code },
    }).catch((err) => console.error("Couldn't count coupon use:", err));
  }

  // Only the call that actually marked it paid sends the emails, so each order emails once.
  if (updated.length > 0) await sendOrderEmails(order.id);

  return { orderId: order.id };
}
