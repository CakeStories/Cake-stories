import { useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ImageUp, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { useEditMode } from "@/lib/edit-mode";

/** Stops a click from also following the link / pressing the button the editable sits in. */
function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

const outline = (status: "idle" | "saving" | "error") =>
  `cursor-text rounded-sm outline-dashed outline-2 outline-offset-2 transition ${
    status === "error"
      ? "outline-destructive"
      : status === "saving"
        ? "outline-current/30"
        : // The text's own colour, so the outline shows on light and coloured backgrounds alike.
          "outline-current/50 hover:outline-current focus:outline-current"
  }`;

/**
 * A piece of text the shop owner can change from the website editor. Normally
 * it renders plain text; in edit mode it gets a dashed outline and can be
 * typed over in place — saved when the box loses focus.
 *
 * Built-in wording is saved under `id` (clearing the box restores the
 * original). Text that comes from the catalogue (a cake's name, a category)
 * passes `onSave` instead, which writes it back to the database.
 */
export function EditableText({
  id,
  children: fallback,
  as: Tag = "span",
  className = "",
  multiline = false,
  onSave,
}: {
  /** Where built-in wording is saved, e.g. "home.celebrations.title". */
  id?: string;
  /** The built-in (or current catalogue) text. */
  children: string;
  as?: ElementType;
  className?: string;
  /** Allow line breaks (Enter adds a new line; click away to save). */
  multiline?: boolean;
  onSave?: (value: string) => Promise<void>;
}) {
  const { content, editing, save } = useEditMode();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  // What the editor just saved through `onSave`, shown until the page data catches up.
  const [saved, setSaved] = useState<string | null>(null);
  const text = onSave ? (saved ?? fallback) : ((id && content[id]) ?? fallback);

  if (!editing || (!id && !onSave)) {
    return <Tag className={`${className} ${multiline ? "whitespace-pre-line" : ""}`}>{text}</Tag>;
  }

  const commit = async (el: HTMLElement) => {
    const raw = el.innerText;
    const next = multiline ? raw.replace(/\n{3,}/g, "\n\n").trim() : raw.replace(/\s+/g, " ").trim();
    if (next === text) return;
    setStatus("saving");
    try {
      if (onSave) {
        if (!next) {
          el.innerText = text; // catalogue text can't be blank
          setStatus("idle");
          return;
        }
        await onSave(next);
        setSaved(next);
      } else if (id) {
        // Clearing the box puts the original text back.
        await save(id, next === "" || next === fallback ? null : next);
        if (next === "") el.innerText = fallback;
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      spellCheck
      title={onSave ? "Click to edit" : "Click to edit · clear it to restore the original"}
      // Many texts sit inside links and buttons: editing shouldn't follow or press them.
      onClick={stop}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        // Typing a space inside a <button> would otherwise press it.
        e.stopPropagation();
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.innerText = text;
          e.currentTarget.blur();
        }
      }}
      onKeyUp={(e: React.KeyboardEvent) => e.preventDefault()}
      onBlur={(e: React.FocusEvent<HTMLElement>) => void commit(e.currentTarget)}
      className={`${className} ${multiline ? "whitespace-pre-line" : ""} ${outline(status)}`}
    >
      {text}
    </Tag>
  );
}

/**
 * A photo the shop owner can replace from the website editor. `children` gets
 * the current image URL; in edit mode a "Change photo" button sits on top.
 * Put it inside a `relative` box. Built-in photos are saved under `id`;
 * catalogue photos (a cake's) pass `onSave` to write the database instead.
 */
export function EditableImage({
  id,
  fallback,
  children,
  buttonPosition = "left-2 top-2",
  compact = false,
  onSave,
}: {
  id?: string;
  fallback: string;
  children: (src: string) => ReactNode;
  /** Where the "Change photo" button sits, so it doesn't cover editable text. */
  buttonPosition?: string;
  /** A small icon-only button, for logos, icons and thumbnails. */
  compact?: boolean;
  onSave?: (imageUrl: string) => Promise<void>;
}) {
  const { content, editing, save, uploadImage } = useEditMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [saved, setSaved] = useState<string | null>(null);
  const src = onSave ? (saved ?? fallback) : ((id && content[id]) ?? fallback);
  const canEdit = editing && (Boolean(id) || Boolean(onSave));

  const pick = async (file: File) => {
    setStatus("busy");
    try {
      const imageUrl = await uploadImage(file);
      if (onSave) {
        await onSave(imageUrl);
        setSaved(imageUrl);
      } else if (id) {
        await save(id, imageUrl);
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      {children(src)}
      {canEdit && (
        <span className={`absolute z-20 flex gap-1.5 ${buttonPosition}`} onClick={stop}>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              inputRef.current?.click();
            }}
            title="Change photo"
            aria-label="Change photo"
            className={`flex items-center gap-1 whitespace-nowrap rounded-full text-[11px] font-semibold text-background shadow ${
              status === "error" ? "bg-destructive" : "bg-foreground/85"
            } ${compact ? "p-1" : "px-2.5 py-1"}`}
          >
            {status === "busy" ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />}
            {!compact && (status === "error" ? "Upload failed — retry" : "Change photo")}
          </button>
          {id && content[id] && (
            <button
              type="button"
              title="Back to the original photo"
              aria-label="Back to the original photo"
              onClick={(e) => {
                stop(e);
                if (window.confirm("Put the original photo back?")) void save(id, null);
              }}
              className="rounded-full bg-foreground/85 p-1.5 text-background shadow"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </span>
      )}
      {/* Outside the page (and any link around the photo): a link's click handler would cancel the file picker. */}
      {canEdit &&
        createPortal(
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            // React bubbles portal events up the component tree too — keep this click from reaching the link.
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pick(file);
            }}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * For wording that isn't shown as page text — a search box's placeholder, a
 * phone number inside a link, a WhatsApp number. Read it with `useSiteText`;
 * this puts a small pencil next to it in edit mode that asks for the new value.
 */
export function EditableValue({
  id,
  fallback,
  label,
  className = "",
}: {
  id: string;
  fallback: string;
  /** What's being changed, e.g. "Search box hint". */
  label: string;
  className?: string;
}) {
  const { content, editing, save } = useEditMode();
  if (!editing) return null;
  const current = content[id] ?? fallback;
  return (
    <button
      type="button"
      title={`Edit: ${label}`}
      aria-label={`Edit: ${label}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        stop(e);
        const next = window.prompt(`${label}\n(leave empty to restore the original)`, current);
        if (next === null) return;
        const value = next.trim();
        void save(id, value === "" || value === fallback ? null : value);
      }}
      className={`z-20 inline-flex shrink-0 items-center justify-center rounded-full bg-foreground/85 p-1 text-background shadow hover:bg-foreground ${className}`}
    >
      <Pencil size={11} />
    </button>
  );
}

/**
 * In edit mode only: a strip listing wording that can't be typed over where it
 * appears (input hints, dropdown lines, messages that only show sometimes),
 * each editable here instead. Customers never see it.
 */
export function HiddenWording({
  items,
  className = "",
}: {
  items: { id: string; fallback: string; label: string }[];
  className?: string;
}) {
  const { editing } = useEditMode();
  if (!editing) return null;
  return (
    <div className={`rounded-md border border-dashed border-primary/50 bg-primary/[0.04] p-3 text-xs ${className}`}>
      <p className="mb-2 font-semibold text-muted-foreground">Other wording on this page (only you see this):</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-muted-foreground">{item.label}:</span>
            <EditableText id={item.id} className="font-medium">
              {item.fallback}
            </EditableText>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * In edit mode: a small button that opens this item in the admin panel
 * (e.g. "Edit cake", "Add a cake here"). Renders nothing for customers.
 */
export function AdminShortcut({
  label,
  search,
  className = "",
}: {
  label: string;
  /** Query string for /manage, e.g. { tab: "products", q: "Bluey" }. */
  search: Record<string, string>;
  className?: string;
}) {
  const { editing, adminPath } = useEditMode();
  if (!editing || !adminPath) return null;
  return (
    // A button, not a link: these often sit inside a cake card that is itself a link.
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        window.location.href = `${adminPath}?${new URLSearchParams(search).toString()}`;
      }}
      className={`z-20 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-semibold text-background shadow hover:bg-foreground ${className}`}
    >
      <Pencil size={11} /> {label}
    </button>
  );
}

/** Fixed bar across the bottom of every page while editing. */
export function EditToolbar() {
  const { editing, adminPath, exit } = useEditMode();
  const onAdminPage = useRouterState({ select: (state) => state.location.pathname.startsWith("/manage") });
  if (!editing || onAdminPage) return null;
  return (
    <>
      {/* Above the phone's bottom tab bar; at the very bottom on larger screens. */}
      <div className="fixed inset-x-0 bottom-16 z-[90] flex h-11 items-center gap-3 bg-foreground px-4 text-xs text-background shadow-lg sm:text-sm md:bottom-0">
        <Pencil size={15} className="shrink-0" />
        <p className="min-w-0 flex-1 truncate">
          <strong>Editing the website.</strong>{" "}
          <span className="opacity-80">
            Click any dashed text to type over it, "Change photo" on a picture, or a ✎ for hidden
            wording. Changes go live for everyone.
          </span>
        </p>
        {adminPath && (
          <Link to={adminPath} className="shrink-0 rounded-md bg-background/15 px-2.5 py-1 font-semibold hover:bg-background/25">
            Admin panel
          </Link>
        )}
        <button
          type="button"
          onClick={exit}
          className="flex shrink-0 items-center gap-1 rounded-md bg-background px-2.5 py-1 font-semibold text-foreground"
        >
          <X size={13} /> Stop editing
        </button>
      </div>
    </>
  );
}
