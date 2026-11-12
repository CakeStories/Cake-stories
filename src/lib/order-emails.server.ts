import { serverEnv } from "@/lib/env.server";
import { serviceRest } from "@/lib/service.server";
import { fetchSiteContent } from "@/lib/site-content";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";

/**
 * Order emails, sent through Resend (resend.com) once an order is paid:
 *   - the customer gets a "Thank you, your order is confirmed" receipt;
 *   - the shop gets a "New order" alert with everything needed to prepare it.
 * Server-only. Nothing is sent until RESEND_API_KEY is set; a failure here is
 * logged and never blocks the payment itself.
 *
 * Settings: RESEND_API_KEY (required), ORDER_EMAIL_FROM (default
 * "Cake Stories <orders@cakestories.in>" — the domain must be verified in
 * Resend), SITE_URL (default https://www.cakestories.in), and
 * ORDER_ALERT_EMAILS — the shop's address(es) for new-order alerts, comma
 * separated. Kept as a private setting rather than in the website editor's
 * content file, which is public.
 */

const DEFAULT_FROM = "Cake Stories <orders@cakestories.in>";
const DEFAULT_SITE_URL = "https://www.cakestories.in";
const DEFAULT_PHONE = "+91 78087 80852";
const DEFAULT_SHOP_EMAIL = "cakepalettee@gmail.com";

const BRAND = "#af1b37";
const INK = "#2c1a17";
const MUTED = "#6b5f5a";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_address: string | null;
  subtotal: number | string;
  delivery_charge: number | string;
  discount_amount: number | string | null;
  gst_amount: number | string | null;
  coupon_code: string | null;
  total: number | string;
  fulfillment_type: "delivery" | "pickup";
  pickup_branch: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  razorpay_payment_id: string | null;
};

type ItemRow = {
  product_id: string | null;
  product_name: string;
  size: string | null;
  flavour: string | null;
  quantity: number;
  unit_price: number | string;
  customization: { note?: string; instructions?: string } | null;
};

export type OrderEmailData = {
  order: OrderRow;
  items: (ItemRow & { image: string | null })[];
};

/* ----------------------------------------------------------- helpers --- */

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (value: number | string | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortMoney = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const orderNumber = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

/** "Sunday, 15 November 2026", or "Sun 15 Nov" for subject lines. */
function niceDate(isoDate: string | null, long = true): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const part = (options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-IN", { timeZone: "UTC", ...options });
  return long
    ? `${part({ weekday: "long" })}, ${part({ day: "numeric", month: "long", year: "numeric" })}`
    : `${part({ weekday: "short" })} ${part({ day: "numeric", month: "short" })}`;
}

function placedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function siteUrl(): string {
  return (serverEnv("SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/$/, "");
}

/** A product photo as a small JPEG/PNG thumbnail, served through the site's own domain. */
function thumbnail(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/storage\/v1\/object\/public\/(.+?)(\?|$)/);
  if (!match) return imageUrl.startsWith("http") ? imageUrl : `${siteUrl()}${imageUrl}`;
  // format=origin keeps JPEG/PNG — some email apps can't show WebP.
  return `${siteUrl()}/sb/storage/v1/render/image/public/${match[1]}?width=128&height=128&resize=cover&format=origin`;
}

function whenLine(order: OrderRow): string {
  const date = niceDate(order.delivery_date);
  const time = order.delivery_time?.replace(" - ", " – ") ?? "";
  return [date, time].filter(Boolean).join(" · ");
}

function itemDetails(item: ItemRow): string[] {
  return [
    item.flavour && `Flavour: ${item.flavour}`,
    item.size && `Size: ${item.size}`,
  ].filter(Boolean) as string[];
}

/** Wraps email content in the shared page shell (tables + inline styles for email apps). */
function shell(inner: string, preheader: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cake Stories</title></head>
<body style="margin:0;padding:0;background:#f4ede6;font-family:Poppins,'Segoe UI',Arial,sans-serif;color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffaf6;border-radius:14px;overflow:hidden">
${inner}
</table></td></tr></table></body></html>`;
}

const section = (html: string, extra = "") =>
  `<tr><td style="padding:20px 28px;border-bottom:1px solid #efe4da;${extra}">${html}</td></tr>`;

const label = (text: string, color = BRAND) =>
  `<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${color}">${esc(text)}</p>`;

function totalsRows(order: OrderRow): string {
  const rows: [string, string][] = [
    ["Subtotal", money(order.subtotal)],
    ["Delivery", Number(order.delivery_charge) > 0 ? money(order.delivery_charge) : "Free"],
  ];
  if (Number(order.discount_amount) > 0) {
    rows.push([`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `− ${money(order.discount_amount)}`]);
  }
  if (Number(order.gst_amount) > 0) rows.push(["GST", money(order.gst_amount)]);
  return rows
    .map(([k, v]) => `<tr><td style="padding:4px 0;font-size:13px">${esc(k)}</td><td align="right" style="padding:4px 0;font-size:13px">${esc(v)}</td></tr>`)
    .join("");
}

/* ------------------------------------------------- customer receipt --- */

export function customerEmail(data: OrderEmailData, contact: { phone: string; whatsapp: string }) {
  const { order, items } = data;
  const first = order.customer_name.trim().split(/\s+/)[0] ?? order.customer_name;
  const pickup = order.fulfillment_type === "pickup";
  const site = siteUrl();

  const itemRows = items
    .map((item) => {
      const img = thumbnail(item.image);
      const lines = [
        [...itemDetails(item), `Qty ${item.quantity}`].join(" · "),
        item.customization?.note && `Message on cake: “${item.customization.note}”`,
        item.customization?.instructions && `Instructions: ${item.customization.instructions}`,
      ].filter(Boolean);
      return `<tr>
<td width="76" valign="top" style="padding:0 0 12px">${img ? `<img src="${esc(img)}" width="64" height="64" alt="" style="display:block;border-radius:10px;object-fit:cover">` : ""}</td>
<td valign="top" style="padding:0 0 12px"><div style="font-weight:600;font-size:14px">${esc(item.product_name)}</div>${lines.map((l) => `<div style="font-size:12px;color:${MUTED};margin-top:2px">${esc(l)}</div>`).join("")}</td>
<td valign="top" align="right" style="padding:0 0 12px;font-weight:600;font-size:14px;white-space:nowrap">${esc(shortMoney(Number(item.unit_price) * item.quantity))}</td></tr>`;
    })
    .join("");

  const where = pickup
    ? `<b>Store pickup · ${esc(whenLine(order))}</b><br>${esc(order.pickup_branch ?? "")}`
    : `<b>${esc(whenLine(order))}</b><br>${esc(order.delivery_address ?? "").replace(/\n/g, "<br>")}`;

  const inner = `
<tr><td align="center" style="padding:26px 24px 18px;background:#ffffff"><img src="${site}/email-logo.png" height="62" alt="Cake Stories" style="display:block;height:62px"></td></tr>
<tr><td align="center" style="background:${BRAND};color:#ffffff;padding:22px 24px">
<div style="font-size:22px;font-weight:700">Thank you, ${esc(first)}! Your order is confirmed.</div>
<div style="font-size:13px;margin-top:6px;opacity:.92">Order ${esc(orderNumber(order.id))} · placed ${esc(placedAt(order.created_at))}</div></td></tr>
${section(`${label("Your order")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>`)}
${section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totalsRows(order)}
<tr><td style="padding:10px 0 0;border-top:1px solid #e6ddd4;font-size:16px;font-weight:700">Total paid</td><td align="right" style="padding:10px 0 0;border-top:1px solid #e6ddd4;font-size:16px;font-weight:700">${esc(money(order.total))}</td></tr></table>
<p style="margin:12px 0 0"><span style="display:inline-block;background:#e8f6ee;color:#1d7a46;font-weight:600;font-size:12px;padding:3px 10px;border-radius:999px">✓ Paid online</span></p>`)}
${section(`${label(pickup ? "Pickup" : "Delivery")}<div style="background:#ffffff;border:1px solid #efe4da;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6">${where}</div>`)}
${section(`<p style="margin:0 0 12px;font-size:13px">Questions or changes? Our Customer Care team is happy to help.</p>
<a href="https://wa.me/${esc(contact.whatsapp.replace(/\D/g, ""))}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">WhatsApp us</a>
<p style="margin:12px 0 0;font-size:13px">or call <b>${esc(contact.phone)}</b></p>`, "text-align:center;border-bottom:0")}
<tr><td align="center" style="padding:16px 24px 26px;font-size:11.5px;color:#7a6e69;line-height:1.7">Cake Stories · Anducode · Pammam · North Street, Marthandam<br>
<a href="${site}" style="color:${BRAND}">www.cakestories.in</a> · <a href="${site}/info/cancellation-refund-policy" style="color:${BRAND}">Cancellation &amp; Refund Policy</a></td></tr>`;

  const text = [
    `Thank you, ${first}! Your Cake Stories order ${orderNumber(order.id)} is confirmed.`,
    "",
    ...items.map(
      (i) =>
        `- ${i.product_name} (${[...itemDetails(i), `Qty ${i.quantity}`].join(", ")})${i.customization?.note ? ` — message: "${i.customization.note}"` : ""}`,
    ),
    "",
    `Total paid: ${money(order.total)}`,
    pickup ? `Store pickup: ${whenLine(order)} at ${order.pickup_branch ?? ""}` : `Delivery: ${whenLine(order)}\n${order.delivery_address ?? ""}`,
    "",
    `Questions? WhatsApp or call ${contact.phone}. ${site}`,
  ].join("\n");

  return {
    subject: `Your Cake Stories order ${orderNumber(order.id)} is confirmed 🎂`,
    html: shell(inner, `Order ${orderNumber(order.id)} · ${pickup ? "Pickup" : "Delivery"} ${whenLine(order)}`),
    text,
  };
}

/* ------------------------------------------------------- shop alert --- */

export function shopEmail(data: OrderEmailData) {
  const { order, items } = data;
  const pickup = order.fulfillment_type === "pickup";
  const when = whenLine(order);
  const instructions = items
    .map((i) => i.customization?.instructions)
    .filter(Boolean)
    .join(" · ");
  const map =
    order.delivery_lat != null && order.delivery_lng != null
      ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
      : null;

  const rows = items
    .map(
      (item) => `<tr>
<td style="padding:9px 0;border-bottom:1px solid #f4ede6;vertical-align:top"><b>${esc(item.product_name)}</b>${
        itemDetails(item).length ? `<br><span style="font-size:12.5px;color:${MUTED}">${esc(itemDetails(item).join(" · "))}</span>` : ""
      }${
        item.customization?.note
          ? `<br><span style="display:inline-block;margin-top:4px;background:#fff4d6;border:1px dashed #d9a400;color:#5c4500;font-size:12.5px;padding:3px 8px;border-radius:6px">On cake: “${esc(item.customization.note)}”</span>`
          : ""
      }</td>
<td align="center" style="padding:9px 0;border-bottom:1px solid #f4ede6;vertical-align:top">${item.quantity}</td>
<td align="right" style="padding:9px 0;border-bottom:1px solid #f4ede6;vertical-align:top">${esc(shortMoney(Number(item.unit_price) * item.quantity))}</td></tr>`,
    )
    .join("");

  const summary = [
    `Subtotal ${money(order.subtotal)}`,
    `Delivery ${Number(order.delivery_charge) > 0 ? money(order.delivery_charge) : "free"}`,
    Number(order.discount_amount) > 0 && `Discount −${money(order.discount_amount)}${order.coupon_code ? ` (${order.coupon_code})` : ""}`,
    Number(order.gst_amount) > 0 && `GST ${money(order.gst_amount)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const inner = `
<tr><td style="background:${INK};color:#ffffff;padding:18px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><div style="font-size:20px;font-weight:700">New order ${esc(orderNumber(order.id))}</div><span style="display:inline-block;margin-top:4px;background:#25a35a;color:#ffffff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px">PAID</span></td>
<td align="right" style="font-size:22px;font-weight:700">${esc(money(order.total))}</td></tr></table></td></tr>
<tr><td style="background:${BRAND};color:#ffffff;padding:14px 26px;font-size:15px;font-weight:600">${pickup ? "STORE PICKUP" : "DELIVERY"} · ${esc(when)}
<div style="font-size:12px;font-weight:400;opacity:.9">Placed ${esc(placedAt(order.created_at))}${order.razorpay_payment_id ? ` · Razorpay payment ${esc(order.razorpay_payment_id)}` : ""}</div></td></tr>
${section(`${label("To prepare", "#8a7d77")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
<tr><td style="font-size:11px;color:#8a7d77;font-weight:600;padding:0 0 6px;border-bottom:1px solid #eee5dc">Item</td><td align="center" style="font-size:11px;color:#8a7d77;font-weight:600;padding:0 0 6px;border-bottom:1px solid #eee5dc">Qty</td><td align="right" style="font-size:11px;color:#8a7d77;font-weight:600;padding:0 0 6px;border-bottom:1px solid #eee5dc">Price</td></tr>
${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:13px"><tr><td>${esc(summary)}</td><td align="right"><b>Total ${esc(money(order.total))}</b></td></tr></table>`, "background:#ffffff")}
${section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;line-height:1.65"><tr>
<td valign="top" width="50%">${label("Customer", "#8a7d77")}<b>${esc(order.customer_name)}</b><br>📞 <a href="tel:${esc(order.customer_phone)}" style="color:${INK}">${esc(order.customer_phone)}</a>${order.customer_email ? `<br>✉️ ${esc(order.customer_email)}` : ""}</td>
<td valign="top" width="50%">${label(pickup ? "Pickup from" : "Deliver to", "#8a7d77")}${esc(pickup ? (order.pickup_branch ?? "") : (order.delivery_address ?? "")).replace(/\n/g, "<br>")}${
    map ? `<br><a href="${map}" style="color:${BRAND};font-size:12.5px">📍 Open pinned location in Maps</a>` : ""
  }</td></tr></table>`, "background:#ffffff")}
${instructions ? section(`${label("Special instructions", "#8a7d77")}<div style="background:#fff4d6;border-left:4px solid #d9a400;padding:10px 14px;font-size:13.5px;border-radius:4px">${esc(instructions)}</div>`, "background:#ffffff") : ""}
<tr><td style="padding:16px 26px 22px;font-size:12px;color:#8a7d77;background:#ffffff">Update this order's status in the admin panel → Orders. Sent automatically by ${esc(siteUrl().replace(/^https?:\/\//, ""))} for every paid order; the customer has received their own confirmation.</td></tr>`;

  const text = [
    `NEW ORDER ${orderNumber(order.id)} — ${money(order.total)} PAID`,
    `${pickup ? "Store pickup" : "Delivery"}: ${when}`,
    "",
    ...items.map(
      (i) =>
        `- ${i.quantity} × ${i.product_name}${itemDetails(i).length ? ` (${itemDetails(i).join(", ")})` : ""}${i.customization?.note ? ` — ON CAKE: "${i.customization.note}"` : ""}`,
    ),
    "",
    `Customer: ${order.customer_name}, ${order.customer_phone}${order.customer_email ? `, ${order.customer_email}` : ""}`,
    pickup ? `Pickup from: ${order.pickup_branch ?? ""}` : `Deliver to: ${order.delivery_address ?? ""}${map ? `\nMap: ${map}` : ""}`,
    instructions ? `Instructions: ${instructions}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return {
    subject: `🛎️ New order ${orderNumber(order.id)} · ${money(order.total)} · ${pickup ? "Pickup" : "Delivery"} ${niceDate(order.delivery_date, false)}${order.delivery_time ? `, ${order.delivery_time}` : ""}`,
    html: shell(inner, `${items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}`),
    text,
  };
}

/* ----------------------------------------------------------- sending --- */

export function orderEmailsConfigured(): boolean {
  return Boolean(serverEnv("RESEND_API_KEY"));
}

/** Where new-order alerts go (ORDER_ALERT_EMAILS). */
export function orderAlertEmails(): string[] {
  return parseEmailList(serverEnv("ORDER_ALERT_EMAILS"));
}

export function orderEmailFrom(): string {
  return serverEnv("ORDER_EMAIL_FROM") ?? DEFAULT_FROM;
}

/** Parses the admin-entered list ("a@x.com, b@y.com" or one per line) into valid, unique addresses. */
export function parseEmailList(raw: string | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) seen.add(email);
  }
  return [...seen].slice(0, 10);
}

async function sendEmail(message: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | undefined;
  idempotencyKey: string;
}): Promise<void> {
  const apiKey = serverEnv("RESEND_API_KEY");
  if (!apiKey) throw new Error("Order emails aren't set up: add RESEND_API_KEY in Vercel.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // A retry of the same order never sends a second copy.
      "idempotency-key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: orderEmailFrom(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo && { reply_to: message.replyTo }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Email not sent (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
}

async function loadOrder(orderId: string): Promise<OrderEmailData | null> {
  const [order] = await serviceRest<OrderRow[]>(`orders?select=*&id=eq.${encodeURIComponent(orderId)}&limit=1`);
  if (!order) return null;
  const items = await serviceRest<ItemRow[]>(
    `order_items?select=product_id,product_name,size,flavour,quantity,unit_price,customization&order_id=eq.${order.id}&order=created_at.asc`,
  );
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  const images = new Map<string, string | null>();
  if (ids.length > 0) {
    const list = `in.(${ids.join(",")})`;
    const [products, addons] = await Promise.all([
      serviceRest<Array<{ id: string; image_url: string | null }>>(`products?select=id,image_url&id=${list}`).catch(() => []),
      serviceRest<Array<{ id: string; image_url: string | null }>>(`addons?select=id,image_url&id=${list}`).catch(() => []),
    ]);
    for (const row of [...products, ...addons]) images.set(row.id, row.image_url);
  }
  return { order, items: items.map((i) => ({ ...i, image: (i.product_id && images.get(i.product_id)) || null })) };
}

/**
 * Sends both emails for a just-paid order. Never throws — a missing setting or
 * an email outage must not turn a successful payment into an error.
 */
export async function sendOrderEmails(orderId: string): Promise<void> {
  if (!orderEmailsConfigured()) return;
  try {
    const [data, content] = await Promise.all([loadOrder(orderId), fetchSiteContent()]);
    if (!data) return;
    const shopTo = orderAlertEmails();
    const contact = {
      phone: content["contact.phone"] ?? DEFAULT_PHONE,
      whatsapp: content["contact.whatsapp"] ?? DEFAULT_WHATSAPP_NUMBER,
    };
    const jobs: Promise<void>[] = [];
    if (data.order.customer_email) {
      const mail = customerEmail(data, contact);
      jobs.push(
        sendEmail({
          ...mail,
          to: [data.order.customer_email],
          replyTo: content["contact.email"] ?? DEFAULT_SHOP_EMAIL,
          idempotencyKey: `order-${orderId}-customer`,
        }),
      );
    }
    if (shopTo.length > 0) {
      const mail = shopEmail(data);
      jobs.push(
        sendEmail({
          ...mail,
          to: shopTo,
          replyTo: data.order.customer_email ?? undefined,
          idempotencyKey: `order-${orderId}-shop`,
        }),
      );
    }
    const results = await Promise.allSettled(jobs);
    for (const result of results) {
      if (result.status === "rejected") console.error("Order email failed:", result.reason);
    }
  } catch (error) {
    console.error("Order emails failed:", error);
  }
}

/** For the admin panel's "Send a test email": the newest paid order, or a sample, to `to`. */
export async function sendTestShopEmail(to: string[]): Promise<{ usedRealOrder: boolean }> {
  const [latest] = await serviceRest<Array<{ id: string }>>(
    "orders?select=id&payment_status=eq.paid&order=created_at.desc&limit=1",
  );
  const data = (latest && (await loadOrder(latest.id))) || sampleOrder();
  const mail = shopEmail(data);
  await sendEmail({
    ...mail,
    subject: `[TEST] ${mail.subject}`,
    to,
    idempotencyKey: `test-${Date.now()}`,
  });
  return { usedRealOrder: Boolean(latest) };
}

function sampleOrder(): OrderEmailData {
  return {
    order: {
      id: "00000000-test-0000-0000-000000000000",
      created_at: new Date().toISOString(),
      customer_name: "Sample Customer",
      customer_email: "customer@example.com",
      customer_phone: "98765 43210",
      delivery_address: "12 North Street, Near Bus Stand, Marthandam 629165",
      subtotal: 800,
      delivery_charge: 60,
      discount_amount: 0,
      gst_amount: 43.9,
      coupon_code: null,
      total: 903.9,
      fulfillment_type: "delivery",
      pickup_branch: null,
      delivery_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
      delivery_time: "9:00 am - 12:00 pm",
      delivery_lat: null,
      delivery_lng: null,
      razorpay_payment_id: null,
    },
    items: [
      {
        product_id: null,
        product_name: "Black Forest Celebration",
        size: "1 kg",
        flavour: "Black Forest",
        quantity: 1,
        unit_price: 770,
        customization: { note: "Happy Birthday!", instructions: "Please call before delivery" },
        image: null,
      },
      { product_id: null, product_name: "Fir Candles", size: null, flavour: null, quantity: 2, unit_price: 15, customization: null, image: null },
    ],
  };
}
