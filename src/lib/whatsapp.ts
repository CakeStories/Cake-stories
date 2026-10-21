/**
 * WhatsApp enquiry links for the Birthday Bash page (fully custom cakes with
 * no fixed catalogue price — customers chat with the shop instead of
 * checking out). Keep this number in sync with what the shop owner gives out
 * elsewhere; it's deliberately separate from the homepage's WhatsApp banner.
 */
const CUSTOM_CAKE_WHATSAPP_NUMBER = "917808780852";

function whatsappLink(message: string): string {
  return `https://wa.me/${CUSTOM_CAKE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** The generic "Chat with us" banner at the top of the page — not tied to any one cake. */
export function customCakeEnquiryLink(): string {
  return whatsappLink(
    "Hi! I'm looking for a customisable cake. Could you help me with the options?",
  );
}

/**
 * The per-cake "Enquire Now" button — pre-fills the cake's name plus
 * whichever flavour/size the customer picked (either, both, or neither).
 */
export function cakeEnquiryLink(
  name: string,
  flavour?: string,
  size?: string,
  extras: { cakeMessage?: string; notes?: string; url?: string } = {},
): string {
  const lines = [`Hi Cake Stories! I'd like to order the ${name}.`];
  if (flavour) lines.push(`Flavour: ${flavour}`);
  if (size) lines.push(`Size: ${size}`);
  if (extras.cakeMessage?.trim()) lines.push(`Message on the cake: "${extras.cakeMessage.trim()}"`);
  if (extras.notes?.trim()) lines.push(`Notes: ${extras.notes.trim()}`);
  if (extras.url) lines.push(extras.url);
  lines.push("Could you share the price and customisation options?");
  return whatsappLink(lines.join("\n"));
}
