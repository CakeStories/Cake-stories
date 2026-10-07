import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getProduct } from "@/lib/catalog";
import {
  ADVANCE_NOTICE_CATEGORY_IDS,
  CAKE_MESSAGE_MAX,
  INSTRUCTIONS_MAX,
  PICKUP_BRANCHES,
  TIME_SLOTS,
  applySitewideDiscount,
  couponDiscount,
  deliveryFeeFor,
  earliestDelivery,
  isoDate,
  shopTodayIso,
  timeSlotIndexForHour,
  type CouponType,
} from "@/lib/pricing";
import { serviceRest, userIdFromAccessToken } from "@/lib/service.server";
import { createRazorpayOrder, isValidPaymentSignature, markOrderPaid } from "@/lib/payments.server";

/**
 * The only place an order's price is decided. The browser sends *what* is in
 * the cart (product/variant/add-on references and quantities); every price,
 * the sitewide sale, the coupon and the delivery fee are worked out here from
 * the database. Nothing the browser says about money is trusted.
 */

const refSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("catalog"), slug: z.string().regex(/^[a-z0-9-]{1,100}$/) }),
  z.object({ type: z.literal("variant"), variantId: z.string().uuid() }),
  z.object({ type: z.literal("addon"), addonId: z.string().uuid() }),
]);

const itemSchema = z.object({
  ref: refSchema,
  quantity: z.number().int().min(1).max(50),
  note: z.string().max(CAKE_MESSAGE_MAX).optional(),
  instructions: z.string().max(INSTRUCTIONS_MAX).optional(),
});

const cartSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  couponCode: z.string().max(40).optional(),
  fulfillmentType: z.enum(["delivery", "pickup"]),
});

type CartInput = z.infer<typeof cartSchema>;

type PricedLine = {
  unitPrice: number;
  name: string;
  size: string | null;
  flavour: string | null;
  productId: string | null;
};

type CouponOutcome =
  | { status: "none" }
  | { status: "applied"; code: string; discount: number }
  | { status: "invalid"; code: string; message: string };

type PricedCart = {
  lines: Array<PricedLine | null>; // null = no longer available
  subtotal: number;
  coupon: CouponOutcome;
  discount: number;
  deliveryFee: number;
  total: number;
  /** True when the cart has a Wedding or Kids cake, which need 24 hours' notice instead of same-day delivery. */
  needsAdvanceNotice: boolean;
};

type VariantRow = {
  id: string;
  size: string | null;
  flavour: string | null;
  price: number | string;
  active: boolean;
  products: { id: string; name: string; active: boolean; category_id: string | null } | null;
};

type AddonRow = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  active: boolean;
};

type CouponRow = {
  code: string;
  discount_type: CouponType;
  discount_value: number | string;
  min_order_amount: number | string | null;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
};

async function sitewidePercent(): Promise<number | null> {
  const [row] = await serviceRest<
    Array<{ sitewide_discount_percent: number | string | null; sitewide_discount_active: boolean }>
  >("store_settings?select=sitewide_discount_percent,sitewide_discount_active&limit=1");
  if (!row?.sitewide_discount_active || row.sitewide_discount_percent == null) return null;
  return Number(row.sitewide_discount_percent);
}

async function evaluateCoupon(
  rawCode: string | undefined,
  subtotal: number,
): Promise<CouponOutcome> {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return { status: "none" };

  const [coupon] = await serviceRest<CouponRow[]>(
    `coupons?select=code,discount_type,discount_value,min_order_amount,active,expires_at,max_uses,times_used&code=eq.${encodeURIComponent(code)}&limit=1`,
  );

  if (!coupon || !coupon.active)
    return { status: "invalid", code, message: "That code isn't valid." };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { status: "invalid", code, message: "That code has expired." };
  }
  if (coupon.max_uses != null && coupon.times_used >= coupon.max_uses) {
    return { status: "invalid", code, message: "That code has been fully used." };
  }
  const minOrder = coupon.min_order_amount != null ? Number(coupon.min_order_amount) : 0;
  if (subtotal < minOrder) {
    return {
      status: "invalid",
      code,
      message: `Add ₹${Math.ceil(minOrder - subtotal)} more to use this code.`,
    };
  }

  const discount = couponDiscount(coupon.discount_type, Number(coupon.discount_value), subtotal);
  return { status: "applied", code: coupon.code, discount };
}

async function priceCart(cart: CartInput): Promise<PricedCart> {
  const variantIds = cart.items.flatMap((i) => (i.ref.type === "variant" ? [i.ref.variantId] : []));
  const addonIds = cart.items.flatMap((i) => (i.ref.type === "addon" ? [i.ref.addonId] : []));

  const [percent, variants, addons] = await Promise.all([
    sitewidePercent(),
    variantIds.length
      ? serviceRest<VariantRow[]>(
          `product_variants?select=id,size,flavour,price,active,products(id,name,active,category_id)&id=in.(${[...new Set(variantIds)].join(",")})`,
        )
      : Promise.resolve([] as VariantRow[]),
    addonIds.length
      ? serviceRest<AddonRow[]>(
          `addons?select=id,name,category,price,active&id=in.(${[...new Set(addonIds)].join(",")})`,
        )
      : Promise.resolve([] as AddonRow[]),
  ]);

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const addonById = new Map(addons.map((a) => [a.id, a]));

  const lines = cart.items.map((item): PricedLine | null => {
    const { ref } = item;
    if (ref.type === "catalog") {
      const product = getProduct(ref.slug);
      if (!product) return null;
      return {
        unitPrice: applySitewideDiscount(product.price, percent),
        name: product.name,
        size: product.weight,
        flavour: null,
        productId: null,
      };
    }
    if (ref.type === "variant") {
      const variant = variantById.get(ref.variantId);
      if (!variant?.active || !variant.products?.active) return null;
      return {
        unitPrice: applySitewideDiscount(Number(variant.price), percent),
        name: variant.products.name,
        size: variant.size,
        flavour: variant.flavour,
        productId: variant.products.id,
      };
    }
    const addon = addonById.get(ref.addonId);
    if (!addon?.active) return null;
    return {
      unitPrice: Number(addon.price),
      name: addon.name,
      size: null,
      flavour: null,
      productId: null,
    };
  });

  const subtotal = lines.reduce(
    (sum, line, i) => sum + (line ? line.unitPrice * cart.items[i]!.quantity : 0),
    0,
  );
  const coupon = await evaluateCoupon(cart.couponCode, subtotal);
  const discount = coupon.status === "applied" ? coupon.discount : 0;
  const deliveryFee = deliveryFeeFor(subtotal, cart.fulfillmentType);

  const needsAdvanceNotice = variants.some(
    (v) => v.products?.category_id && ADVANCE_NOTICE_CATEGORY_IDS.has(v.products.category_id),
  );

  return {
    lines,
    subtotal,
    coupon,
    discount,
    deliveryFee,
    total: Math.max(0, subtotal - discount + deliveryFee),
    needsAdvanceNotice,
  };
}

/** Live price check for the checkout page: current prices, coupon result and totals. */
export const quoteCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => cartSchema.parse(data))
  .handler(async ({ data }) => {
    const priced = await priceCart(data);
    return {
      unitPrices: priced.lines.map((line) => line?.unitPrice ?? null),
      subtotal: priced.subtotal,
      coupon: priced.coupon,
      discount: priced.discount,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      needsAdvanceNotice: priced.needsAdvanceNotice,
    };
  });

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{10,16}$/, "Enter a valid phone number."),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  address: z.string().trim().max(500).default(""),
  city: z.string().trim().max(100).default(""),
  pincode: z.string().trim().max(10).default(""),
  pickupBranch: z.string().optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  deliveryTime: z.string(),
  deliveryLat: z.number().min(-90).max(90).nullable().optional(),
  deliveryLng: z.number().min(-180).max(180).nullable().optional(),
});

const createOrderSchema = cartSchema.extend({
  details: detailsSchema,
  accessToken: z.string().max(4000).optional(),
});

function checkDetails(data: z.infer<typeof createOrderSchema>, needsAdvanceNotice: boolean) {
  const { details, fulfillmentType } = data;
  if (fulfillmentType === "delivery") {
    if (!details.address) throw new Error("Enter your delivery address.");
    if (!details.city) throw new Error("Enter your city.");
    if (!/^\d{6}$/.test(details.pincode)) throw new Error("Enter a valid 6-digit pincode.");
  } else if (!details.pickupBranch || !PICKUP_BRANCHES.includes(details.pickupBranch)) {
    throw new Error("Choose a pickup branch.");
  }
  if (!TIME_SLOTS.includes(details.deliveryTime)) throw new Error("Choose a time slot.");

  const today = shopTodayIso();
  const latest = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (details.deliveryDate < today) throw new Error("Choose a date from today onwards.");
  if (details.deliveryDate > latest) throw new Error("We take orders up to 90 days ahead.");

  // Wedding and Kids cakes need at least 24 hours' notice — a cart mixing
  // one of those with a same-day cake takes the longer of the two, since
  // it's one delivery for the whole order.
  const earliest = earliestDelivery(needsAdvanceNotice);
  const earliestDate = isoDate(earliest);
  if (details.deliveryDate < earliestDate) {
    throw new Error(
      needsAdvanceNotice
        ? "Wedding and Kids cakes need at least 24 hours' notice — pick a later date."
        : "Today's same-day delivery window has closed — pick a later date.",
    );
  }
  if (details.deliveryDate === earliestDate) {
    const chosenSlotIndex = TIME_SLOTS.indexOf(details.deliveryTime);
    const earliestSlotIndex = timeSlotIndexForHour(earliest.getUTCHours());
    if (chosenSlotIndex < earliestSlotIndex) {
      throw new Error("That time is too soon for this order — pick a later time slot.");
    }
  }
}

/**
 * Prices the cart, saves the order as "pending", and opens a Razorpay order for
 * exactly that amount. The order is recorded for every customer — signed in
 * or not — before any money moves, so the shop always knows what was bought.
 */
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const priced = await priceCart(data);
    checkDetails(data, priced.needsAdvanceNotice);

    if (priced.lines.some((line) => line === null)) {
      throw new Error(
        "Some items in your cart are no longer available. Remove them and try again.",
      );
    }
    if (priced.coupon.status === "invalid") throw new Error(priced.coupon.message);
    if (priced.total < 1) throw new Error("Your order total must be at least ₹1.");

    const userId = data.accessToken ? await userIdFromAccessToken(data.accessToken) : null;
    const { details, fulfillmentType } = data;
    const deliveryAddress =
      fulfillmentType === "pickup"
        ? `Store pickup — ${details.pickupBranch}`
        : `${details.address}, ${details.city} ${details.pincode}`;

    const payment = await createRazorpayOrder(Math.round(priced.total * 100), `cs_${Date.now()}`, {
      customer: details.name.slice(0, 250),
      phone: details.phone,
      fulfillment: fulfillmentType,
      date: `${details.deliveryDate} ${details.deliveryTime}`,
    });

    const [order] = await serviceRest<Array<{ id: string }>>("orders", {
      method: "POST",
      body: {
        user_id: userId,
        customer_name: details.name,
        customer_email: details.email,
        customer_phone: details.phone,
        delivery_address: deliveryAddress,
        subtotal: priced.subtotal,
        delivery_charge: priced.deliveryFee,
        discount_amount: priced.discount,
        coupon_code: priced.coupon.status === "applied" ? priced.coupon.code : null,
        total: priced.total,
        fulfillment_type: fulfillmentType,
        pickup_branch: fulfillmentType === "pickup" ? details.pickupBranch : null,
        delivery_date: details.deliveryDate,
        delivery_time: details.deliveryTime,
        delivery_lat: fulfillmentType === "delivery" ? (details.deliveryLat ?? null) : null,
        delivery_lng: fulfillmentType === "delivery" ? (details.deliveryLng ?? null) : null,
        payment_status: "pending",
        order_status: "pending",
        razorpay_order_id: payment.razorpayOrderId,
      },
    });
    if (!order?.id) throw new Error("We couldn't save your order. Please try again.");

    await serviceRest("order_items", {
      method: "POST",
      body: data.items.map((item, i) => {
        const line = priced.lines[i]!;
        const note = item.note?.trim();
        const instructions = item.instructions?.trim();
        return {
          order_id: order.id,
          product_id: line.productId,
          product_name: line.name,
          size: line.size,
          flavour: line.flavour,
          quantity: item.quantity,
          unit_price: line.unitPrice,
          customization:
            note || instructions
              ? { note: note || undefined, instructions: instructions || undefined }
              : null,
        };
      }),
    });

    return {
      razorpayOrderId: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      keyId: payment.keyId,
      total: priced.total,
    };
  });

/** Called by the browser after Razorpay reports success; marks the saved order as paid. */
export const confirmCheckoutPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        razorpayOrderId: z.string().min(1).max(100),
        paymentId: z.string().min(1).max(100),
        signature: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const valid = await isValidPaymentSignature(
      data.razorpayOrderId,
      data.paymentId,
      data.signature,
    );
    if (!valid) return { ok: false as const };
    const { orderId } = await markOrderPaid(data.razorpayOrderId, data.paymentId);
    return { ok: true as const, orderRef: orderId.slice(0, 8).toUpperCase() };
  });
