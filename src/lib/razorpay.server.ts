import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// These two server functions are the only place the Razorpay secret key is used.
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET must be set as server-side env vars
// (see .env.example) — get test keys from the Razorpay dashboard under
// Settings > API Keys. Never move key_secret into a VITE_ variable or any
// client-side code.

const createOrderSchema = z.object({
  amountInPaise: z.number().int().positive(),
  receipt: z.string().max(40),
});

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const keyId = serverEnv("RAZORPAY_KEY_ID");
    const keySecret = serverEnv("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      throw new Error(
        "Payments aren't configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server (see .env.example).",
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: data.amountInPaise,
        currency: "INR",
        receipt: data.receipt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Razorpay order creation failed: ${body}`);
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId };
  });

const verifyPaymentSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifyPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const keySecret = serverEnv("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      throw new Error("Payments aren't configured yet. Set RAZORPAY_KEY_SECRET on the server.");
    }

    const { createHmac } = await import("node:crypto");
    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${data.orderId}|${data.paymentId}`)
      .digest("hex");

    return { valid: expectedSignature === data.signature };
  });
