import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { flavourLabel } from "@/lib/flavours";
import { cakeEnquiryLink } from "@/lib/whatsapp";
import { onProductImageError } from "@/lib/image-fallback";
import type { GenericCake } from "@/lib/generic-cakes";
import { responsiveImage } from "@/lib/supabase";
import { EditableImage, EditableText, EditableValue } from "@/components/editable";
import { useEditMode, useSiteText } from "@/lib/edit-mode";

/**
 * One Birthday Bash cake, shown in full rather than linking to its own page —
 * these are fully custom designs, so instead of Add to Cart there's a
 * WhatsApp "Enquire Now" that carries over whatever flavour/size was picked
 * (or nothing, if the customer just wants to ask).
 */
export function BirthdayBashCakeRow({ cake }: { cake: GenericCake }) {
  const [flavour, setFlavour] = useState<string | undefined>(undefined);
  const [size, setSize] = useState<string | undefined>(undefined);
  const { saveProduct, editing } = useEditMode();
  const save = (field: "name" | "description" | "badge") => (value: string) => saveProduct(cake.id, { [field]: value });
  // Dropdown first lines can't hold editable text, so they're edited with a ✎ beside the label.
  const chooseFlavour = useSiteText("bash.chooseFlavour", "Choose a flavour");
  const chooseSize = useSiteText("bash.chooseSize", "Choose a size");

  const enquireHref = cakeEnquiryLink(
    cake.name,
    cake.flavours.length > 0 ? flavour : undefined,
    cake.sizes.length > 0 ? size : undefined,
  );

  return (
    <article className="grid grid-cols-1 items-stretch gap-6 border-b border-border pb-10 last:border-b-0 sm:grid-cols-2 sm:gap-10">
      <div
        className="relative overflow-hidden rounded-lg bg-muted sm:h-full"
      >
        <EditableImage
          fallback={cake.image}
          buttonPosition="right-3 top-3"
          onSave={(image_url) => saveProduct(cake.id, { image_url })}
        >
          {(src) => (
            <img
              {...responsiveImage(src, 640, "(min-width: 640px) 50vw, 100vw")}
              alt={cake.name}
              onError={onProductImageError}
              // In-flow square on phones (iOS Safari collapses an aspect-ratio box that only
              // holds an absolutely positioned image); stretched to the text column on wider screens.
              className="block aspect-square w-full object-contain sm:absolute sm:inset-0 sm:aspect-auto sm:h-full"
            />
          )}
        </EditableImage>
        {cake.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-secondary-foreground">
            <EditableText onSave={save("badge")}>{cake.badge}</EditableText>
          </span>
        )}
      </div>

      <div className="flex flex-col justify-center">
        <EditableText as="h2" className="block font-display text-2xl sm:text-3xl" onSave={save("name")}>
          {cake.name}
        </EditableText>

        {/* Customisable table kit — no price on the site; agreed on WhatsApp. */}
        <EditableText id="card.enquire" as="p" className="mt-2 block text-sm font-semibold text-primary">
          Enquire for price
        </EditableText>

        {(cake.description || editing) && (
          <EditableText as="p" multiline className="mt-3 block text-sm leading-6 text-foreground/80" onSave={save("description")}>
            {cake.description ?? ""}
          </EditableText>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {cake.flavours.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <EditableText id="panel.flavour">Flavour</EditableText>
                <EditableValue id="bash.chooseFlavour" fallback="Choose a flavour" label="Flavour dropdown's first line" />
              </span>
              <span className="relative block">
                <select
                  value={flavour ?? ""}
                  onChange={(e) => setFlavour(e.target.value || undefined)}
                  className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{chooseFlavour}</option>
                  {cake.flavours.map((f) => (
                    <option key={f} value={f}>
                      {flavourLabel(f)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </span>
            </label>
          )}

          {cake.sizes.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <EditableText id="panel.size">Size</EditableText>
                <EditableValue id="bash.chooseSize" fallback="Choose a size" label="Size dropdown's first line" />
              </span>
              <span className="relative block">
                <select
                  value={size ?? ""}
                  onChange={(e) => setSize(e.target.value || undefined)}
                  className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{chooseSize}</option>
                  {cake.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </span>
            </label>
          )}
        </div>

        <a
          href={enquireHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          <MessageCircle size={17} />
          <EditableText id="bash.enquireNow">Enquire Now</EditableText>
        </a>
      </div>
    </article>
  );
}
