import bannerImage from "@/assets/cake-stories-birthday-bash-banner.jpg";
import { customCakeEnquiryLink } from "@/lib/whatsapp";

/** The clickable banner at the top of Birthday Bash — the whole thing opens a WhatsApp chat. */
export function CustomizeWhatsAppBanner() {
  return (
    <a
      href={customCakeEnquiryLink()}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg transition-opacity hover:opacity-95"
    >
      <img
        src={bannerImage}
        alt="Looking for a customisable cake? Connect with us on WhatsApp for orders."
        className="h-28 w-full object-cover object-center sm:h-36 md:h-44"
      />
    </a>
  );
}
