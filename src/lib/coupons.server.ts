import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

/**
 * Coupon codes are looked up here, server-side, with the service-role key —
 * never via the browser's anon key. The `coupons` table intentionally has no
 * public SELECT policy, so this is the only way to check a code, and it only
 * ever returns the result for the one code submitted, never the full list.
 */
async function serviceRest<T>(path: string): Promise<T> {
  const url = serverEnv("SUPABASE_URL") ?? serverEnv("VITE_SUPABASE_URL");
  const key = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Coupon codes aren't configured yet. Set SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

type CouponRow = {
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number | string;
  min_order_amount: number | string | null;
  active: boolean;
  expires_at: string | null;
};

export type CouponResult =
  | { valid: true; code: string; discountType: "percent" | "flat"; discountValue: number; discountAmount: number }
  | { valid: false; message: string };

export const validateCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ code: z.string().min(1).max(40), subtotal: z.number().nonnegative() }).parse(data),
  )
  .handler(async ({ data }): Promise<CouponResult> => {
    const code = data.code.trim().toUpperCase();
    if (!code) return { valid: false, message: "Enter a code." };

    const rows = await serviceRest<CouponRow[]>(
      `coupons?select=code,discount_type,discount_value,min_order_amount,active,expires_at&code=eq.${encodeURIComponent(code)}&limit=1`,
    );
    const coupon = rows[0];

    if (!coupon || !coupon.active) {
      return { valid: false, message: "That code isn't valid." };
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return { valid: false, message: "That code has expired." };
    }

    const minOrder = coupon.min_order_amount != null ? Number(coupon.min_order_amount) : 0;
    if (data.subtotal < minOrder) {
      return { valid: false, message: `Add ₹${Math.ceil(minOrder - data.subtotal)} more to use this code.` };
    }

    const discountValue = Number(coupon.discount_value);
    const discountAmount =
      coupon.discount_type === "percent"
        ? Math.round((data.subtotal * discountValue) / 100)
        : Math.min(discountValue, data.subtotal);

    return { valid: true, code: coupon.code, discountType: coupon.discount_type, discountValue, discountAmount };
  });
