import { supabaseRestAsUser } from "@/lib/supabase";

export type OrderRecord = {
  id: string;
  subtotal: number;
  delivery_charge: number;
  discount_amount: number | null;
  coupon_code: string | null;
  total: number;
  payment_status: string;
  order_status: string;
  delivery_address: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  fulfillment_type: string;
  pickup_branch: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  order_items: Array<{
    product_name: string;
    flavour: string | null;
    size: string | null;
    quantity: number;
    unit_price: number;
    customization: { note?: string; instructions?: string } | null;
  }>;
};

// Orders are written only by the server (src/lib/checkout.server.ts), which
// prices the cart itself. Customers can read their own paid orders here;
// abandoned checkouts (never paid) are left out.
export async function getMyOrders(accessToken: string): Promise<OrderRecord[]> {
  return supabaseRestAsUser<OrderRecord>("orders", accessToken, {
    select:
      "id,subtotal,delivery_charge,discount_amount,coupon_code,total,payment_status,order_status,delivery_address,delivery_date,delivery_time,fulfillment_type,pickup_branch,razorpay_payment_id,created_at,order_items(product_name,flavour,size,quantity,unit_price,customization)",
    filters: { payment_status: "eq.paid" },
    order: "created_at.desc",
  });
}
