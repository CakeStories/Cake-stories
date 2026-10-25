import { useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ImageUp, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { useEditMode } from "@/lib/edit-mode";

/**
 * A piece of text the shop owner can change from the website editor. Normally
 * it renders plain text; in edit mode it gets a dashed outline and can be
 * typed over in place — saved when the box loses focus.
 */
export function EditableText({
  id,
  children: fallback,
  as: Tag = "span",
  className = "",
}: {
  /** Where the change is saved, e.g. "home.celebrations.title". */
  id: string;
  /** The built-in text. */
  children: string;
  as?: ElementType;
  className?: string;
}) {
  const { content, editing, save } = useEditMode();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const text = content[id] ?? fallback;

  if (!editing) return <Tag className={className}>{text}</Tag>;

  const commit = async (el: HTMLElement) => {
    const next = el.innerText.replace(/\s+/g, " ").trim();
    if (next === text) return;
    setStatus("saving");
    try {
      // Clearing the box puts the original text back.
      await save(id, next === "" || next === fallback ? null : next);
      if (next === "") el.innerText = fallback;
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
      title="Click to edit · clear it to restore the original"
      // Many texts sit inside links: editing shouldn't follow them.
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.innerText = text;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => void commit(e.currentTarget)}
      className={`${className} cursor-text rounded-sm outline-dashed outline-2 outline-offset-2 transition ${
        status === "error" ? "outline-destructive" : status === "saving" ? "outline-primary/40" : "outline-primary/60 hover:outline-primary focus:outline-primary"
      }`}
    >
      {text}
    </Tag>
  );
}

/**
 * A photo the shop owner can replace from the website editor. `children` gets
 * the current image URL; in edit mode a "Change photo" button sits on top.
 * Put it inside a `relative` box.
 */
export function EditableImage({
  id,
  fallback,
  children,
  buttonPosition = "left-2 top-2",
}: {
  id: string;
  fallback: string;
  children: (src: string) => ReactNode;
  /** Where the "Change photo" button sits, so it doesn't cover editable text. */
  buttonPosition?: string;
}) {
  const { content, editing, save, uploadImage } = useEditMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const src = content[id] ?? fallback;

  const pick = async (file: File) => {
    setStatus("busy");
    try {
      await save(id, await uploadImage(file));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {children(src)}
      {editing && (
        <span className={`absolute z-20 flex gap-1.5 ${buttonPosition}`} onClick={stop}>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              inputRef.current?.click();
            }}
            className="flex items-center gap-1 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-semibold text-background shadow"
          >
            {status === "busy" ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />}
            {status === "error" ? "Upload failed — retry" : "Change photo"}
          </button>
          {content[id] && (
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
      {editing &&
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
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `${adminPath}?${new URLSearchParams(search).toString()}`;
      }}
      className={`z-20 inline-flex items-center gap-1 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-semibold text-background shadow hover:bg-foreground ${className}`}
    >
      <Pencil size={11} /> {label}
    </button>
  );
}

/** Fixed bar across the top of every page while editing. */
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
            Click any dashed text to type over it, or "Change photo" on a picture. Changes go live for
            everyone.
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
