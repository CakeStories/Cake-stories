import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Clock,
  Facebook,
  Home,
  Instagram,
  Mail,
  MapPin,
  Phone,
  CakeSlice,
} from "lucide-react";
import { Button } from "@/components/button";
import { EditableImage, EditableText, EditableValue } from "@/components/editable";
import { subscribeToNewsletter } from "@/lib/newsletter.server";
import { BRANCH_LOCATIONS } from "@/lib/delivery-location";
import { INFO_PAGES } from "@/lib/info-pages";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { useEditMode, useSiteText } from "@/lib/edit-mode";
import { resizedImageUrl } from "@/lib/supabase";
import { DEFAULT_WHATSAPP_NUMBER, whatsappDigits } from "@/lib/whatsapp";

const CONTACT_PHONE = "+91 78087 80852";
const CONTACT_EMAIL = "cakepalettee@gmail.com";
const INSTAGRAM_URL = "https://www.instagram.com/cakestoriesofficial/";
const FACEBOOK_URL = "https://www.facebook.com/cakestoriesofficial";
const BUSINESS_HOURS = "9:00 AM – 9:00 PM, every day";

export function SiteFooter() {
  const { content } = useEditMode();
  // Contact details are edited in place; links are built from whatever is shown.
  const phone = content["contact.phone"] ?? CONTACT_PHONE;
  const email = content["contact.email"] ?? CONTACT_EMAIL;
  const instagram = content["contact.instagram"] ?? INSTAGRAM_URL;
  const facebook = content["contact.facebook"] ?? FACEBOOK_URL;
  const whatsapp = content["contact.whatsapp"] ?? DEFAULT_WHATSAPP_NUMBER;

  return (
    <>
      <section className="border-b border-border bg-background py-12">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:px-6">
          <div className="min-w-0">
            <EditableText
              id="footer.newsletter.kicker"
              as="p"
              className="text-xs font-bold uppercase tracking-widest text-primary"
            >
              Fresh from the oven
            </EditableText>
            <EditableText id="footer.newsletter.title" as="h2" className="mt-2 font-display text-3xl">
              Get our newsletter updates
            </EditableText>
            <EditableText id="footer.newsletter.intro" as="p" className="mt-2 text-sm text-muted-foreground">
              New flavours, celebration ideas and special offers, sent occasionally.
            </EditableText>
          </div>
          <NewsletterForm />
        </div>
      </section>

      {/* The extra bottom space on phones sits under the fixed tab bar, so the dark footer runs to the screen edge. */}
      <footer className="bg-foreground pb-28 pt-12 text-background md:pb-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="relative inline-block">
                <EditableImage
                  id="footer.logo"
                  fallback={content["site.logo"] ?? "/cake-stories-logo-sm.webp"}
                  buttonPosition="-right-7 top-0"
                  compact
                >
                  {(src) => (
                    <img
                      src={resizedImageUrl(src, 300)}
                      width={300}
                      height={146}
                      alt="Cake Stories"
                      // The site logo is turned white on this dark background; an uploaded footer logo is shown as is.
                      className={`h-10 w-auto ${content["footer.logo"] ? "" : "brightness-0 invert"}`}
                    />
                  )}
                </EditableImage>
              </span>
              <EditableText id="footer.tagline" as="p" className="mt-3 block max-w-xs text-sm text-background/65">
                Handcrafted cakes for every chapter worth celebrating.
              </EditableText>
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Cake Stories on Instagram"
                  className="flex size-9 items-center justify-center rounded-full bg-background/10 text-background transition hover:bg-background/20"
                >
                  <Instagram size={17} />
                </a>
                <EditableValue id="contact.instagram" fallback={INSTAGRAM_URL} label="Instagram page link" />
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Cake Stories on Facebook"
                  className="flex size-9 items-center justify-center rounded-full bg-background/10 text-background transition hover:bg-background/20"
                >
                  <Facebook size={17} />
                </a>
                <EditableValue id="contact.facebook" fallback={FACEBOOK_URL} label="Facebook page link" />
              </div>
            </div>

            <div>
              <EditableText
                id="footer.contact.title"
                as="h3"
                className="text-xs font-bold uppercase tracking-widest text-background/50"
              >
                Get in touch
              </EditableText>
              <ul className="mt-3 space-y-2.5 text-sm text-background/75">
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-background">
                    <Phone size={15} className="shrink-0 text-background/50" />
                    <EditableText id="contact.phone">{CONTACT_PHONE}</EditableText>
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/${whatsappDigits(whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-background"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-[15px] shrink-0 text-background/50">
                      <path d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12.004 2.004c-5.514 0-9.996 4.482-9.996 9.996 0 1.763.464 3.489 1.346 5.005L2 22l5.117-1.341a9.96 9.96 0 0 0 4.887 1.244h.004c5.514 0 9.996-4.483 9.996-9.996 0-2.67-1.04-5.18-2.928-7.07a9.93 9.93 0 0 0-7.072-2.93zm0 18.17h-.003a8.26 8.26 0 0 1-4.212-1.154l-.302-.18-3.037.796.81-2.96-.198-.304a8.263 8.263 0 0 1-1.269-4.372c0-4.564 3.714-8.278 8.277-8.278 2.211 0 4.288.861 5.851 2.425a8.22 8.22 0 0 1 2.422 5.854c0 4.563-3.713 8.173-8.339 8.173z" />
                    </svg>
                    <EditableText id="footer.contact.whatsapp">WhatsApp us</EditableText>
                  </a>
                  <EditableValue
                    id="contact.whatsapp"
                    fallback={DEFAULT_WHATSAPP_NUMBER}
                    label="WhatsApp number (used by every Enquire on WhatsApp button)"
                  />
                </li>
                <li>
                  <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-background">
                    <Mail size={15} className="shrink-0 text-background/50" />
                    <EditableText id="contact.email">{CONTACT_EMAIL}</EditableText>
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={15} className="shrink-0 text-background/50" />
                  <EditableText id="contact.hours">{BUSINESS_HOURS}</EditableText>
                </li>
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <EditableText
                id="footer.shops.title"
                as="h3"
                className="text-xs font-bold uppercase tracking-widest text-background/50"
              >
                Our shops
              </EditableText>
              <div className="mt-3 grid gap-5 sm:grid-cols-3">
                {BRANCH_LOCATIONS.map((branch) => {
                  const branchPhone = content[`branch.${branch.id}.phone`] ?? branch.phone;
                  const mapsUrl = content[`branch.${branch.id}.maps`] ?? branch.mapsUrl;
                  return (
                    <div key={branch.id} className="text-sm text-background/75">
                      <EditableText id={`branch.${branch.id}.label`} as="p" className="font-medium text-background">
                        {branch.label}
                      </EditableText>
                      <p className="mt-1 flex gap-1.5 text-background/65">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-background/50" />
                        <EditableText id={`branch.${branch.id}.address`}>{branch.address}</EditableText>
                      </p>
                      <a
                        href={`tel:${branchPhone.replace(/\s/g, "")}`}
                        className="mt-1 flex items-center gap-1.5 hover:text-background"
                      >
                        <Phone size={14} className="shrink-0 text-background/50" />
                        <EditableText id={`branch.${branch.id}.phone`}>{branch.phone}</EditableText>
                      </a>
                      <span className="mt-1 flex items-center gap-1.5">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-medium underline underline-offset-2 text-background/60 hover:text-background"
                        >
                          <EditableText id="footer.shops.directions">Get directions</EditableText>
                        </a>
                        <EditableValue
                          id={`branch.${branch.id}.maps`}
                          fallback={branch.mapsUrl}
                          label={`Google Maps link for ${branch.label}`}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-background/10 pt-6 text-sm text-background/60">
            <span>
              © {new Date().getFullYear()}{" "}
              <EditableText id="footer.copyright">Cake Stories. All rights reserved.</EditableText>
            </span>
            <nav aria-label="About Cake Stories" className="flex flex-wrap gap-x-5 gap-y-2">
              {INFO_PAGES.map((page) => (
                <Link
                  key={page.slug}
                  to="/info/$page"
                  params={{ page: page.slug }}
                  className="transition-colors hover:text-background"
                >
                  <EditableText id={`info.${page.slug}.title`}>{page.title}</EditableText>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>

      <MobileTabBar />
    </>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const placeholder = useSiteText("footer.newsletter.placeholder", "Your email address");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("busy");
    try {
      await subscribeToNewsletter({ data: { email } });
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <EditableText id="footer.newsletter.thanks" as="p" className="w-full max-w-md text-sm font-medium text-success">
        Thanks — you're on the list!
      </EditableText>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form className="flex items-center gap-2" onSubmit={submit}>
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <EditableValue id="footer.newsletter.placeholder" fallback="Your email address" label="Email box hint" />
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? (
            <EditableText id="footer.newsletter.busy">Subscribing…</EditableText>
          ) : (
            <EditableText id="footer.newsletter.button">Subscribe</EditableText>
          )}
        </Button>
      </form>
      {state === "error" && (
        <EditableText id="footer.newsletter.error" as="p" className="mt-1.5 block text-xs text-destructive">
          Couldn't sign you up just now — please try again.
        </EditableText>
      )}
    </div>
  );
}

// The phone tab bar: home, the main cake categories, and a WhatsApp chat.
// (Wishlist and bag sit in the header, top right.) Names and icons can be
// changed in the website editor.
const TAB_BAR_CATEGORIES = [
  { slug: "birthday-cakes", label: "Birthday" },
  { slug: "wedding-cakes", label: "Wedding" },
  { slug: "kids-cakes", label: "Kids" },
  { slug: "holy-communion-cakes", label: "Communion" },
  { slug: "anniversary-cakes", label: "Anniversary" },
];

// Three buttons fill the screen; swipe sideways for the rest.
const tabClass = (active: boolean) =>
  `flex h-12 basis-1/3 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium transition ${
    active ? "text-primary" : "text-foreground hover:text-primary"
  }`;

// Tints the black line icons brand red on the page you're on.
const ACTIVE_ICON_FILTER = "invert(15%) sepia(80%) saturate(4000%) hue-rotate(335deg) brightness(85%)";

function MobileTabBar() {
  const { content } = useEditMode();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const whatsapp = content["contact.whatsapp"] ?? DEFAULT_WHATSAPP_NUMBER;
  // Fade the edge that has more buttons beyond it, so it's clear the bar swipes.
  const [edges, setEdges] = useState({ left: false, right: true });
  const onScroll = (el: HTMLDivElement) =>
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });

  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div
        onScroll={(e) => onScroll(e.currentTarget)}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto px-3 py-2 [scroll-padding-inline:0.75rem]"
      >
      <Link to="/" className={tabClass(pathname === "/")}>
        <Home size={18} />
        <EditableText id="tabbar.home" className="max-w-full truncate">Home</EditableText>
      </Link>
      {TAB_BAR_CATEGORIES.map(({ slug, label }) => {
        const active = pathname === `/category/${slug}`;
        return (
          <Link key={slug} to="/category/$categorySlug" params={{ categorySlug: slug }} className={tabClass(active)}>
            <EditableImage id={`nav.icon.${slug}`} fallback={CATEGORY_ICONS[slug] ?? ""} buttonPosition="-right-3 -top-3" compact>
              {(icon) =>
                icon ? (
                  <img
                    src={resizedImageUrl(icon, 48)}
                    alt=""
                    className="h-[18px] w-[18px] object-contain"
                    {...(active && { style: { filter: ACTIVE_ICON_FILTER } })}
                  />
                ) : (
                  <CakeSlice size={18} />
                )
              }
            </EditableImage>
            <EditableText id={`tabbar.${slug}`} className="max-w-full truncate">{label}</EditableText>
          </Link>
        );
      })}
      <a href={`https://wa.me/${whatsappDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer" className={tabClass(false)}>
        <WhatsAppIcon />
        <EditableText id="tabbar.whatsapp" className="max-w-full truncate">WhatsApp</EditableText>
      </a>
      </div>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity ${edges.left ? "opacity-100" : "opacity-0"}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity ${edges.right ? "opacity-100" : "opacity-0"}`}
      />
    </nav>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="#25D366">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
