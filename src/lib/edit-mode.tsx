import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteContent, type SiteContent } from "@/lib/site-content";
import { adminSaveSiteContent, adminUploadSiteImage } from "@/lib/admin.server";

/** Same key the /manage page keeps its sign-in token under (sessionStorage, this tab only). */
const ADMIN_TOKEN_KEY = "cake-stories:admin-token";
/** Set by /manage's "Edit website" button: the admin page to come back to. */
const EDIT_MODE_KEY = "cake-stories:edit-mode";

export function startEditMode(adminPath: string) {
  try {
    window.sessionStorage.setItem(EDIT_MODE_KEY, adminPath);
  } catch {
    // ignore storage errors
  }
}

type EditModeValue = {
  content: SiteContent;
  /** True while the shop owner is editing (signed in on /manage in this tab). */
  editing: boolean;
  /** Where "Back to admin" and the "Edit cake" links go, e.g. /manage/abc123. */
  adminPath: string | null;
  save: (key: string, value: string | null) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  exit: () => void;
};

const EditModeContext = createContext<EditModeValue | null>(null);

function readSession() {
  try {
    const token = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const adminPath = window.sessionStorage.getItem(EDIT_MODE_KEY);
    return token && adminPath ? { token, adminPath } : null;
  } catch {
    return null;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export function EditModeProvider({ initialContent, children }: { initialContent: SiteContent; children: ReactNode }) {
  const [session, setSession] = useState<{ token: string; adminPath: string } | null>(null);
  // Saved edits show straight away for the editor, before the file is re-read.
  const [local, setLocal] = useState<SiteContent>({});

  useEffect(() => setSession(readSession()), []);

  const { data: fetched } = useQuery({
    queryKey: ["site-content"],
    queryFn: fetchSiteContent,
    initialData: initialContent,
    // The page itself may be a cached copy (see start.ts) — re-read once it's open.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });

  const content = useMemo(() => ({ ...fetched, ...local }), [fetched, local]);

  const save = useCallback(
    async (key: string, value: string | null) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      const { content: saved } = await adminSaveSiteContent({ data: { token: session.token, key, value } });
      setLocal(saved);
    },
    [session],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      const base64 = await fileToBase64(file);
      const { imageUrl } = await adminUploadSiteImage({
        data: { token: session.token, fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      return imageUrl;
    },
    [session],
  );

  const exit = useCallback(() => {
    try {
      window.sessionStorage.removeItem(EDIT_MODE_KEY);
    } catch {
      // ignore storage errors
    }
    setSession(null);
  }, []);

  const value = useMemo<EditModeValue>(
    () => ({ content, editing: session != null, adminPath: session?.adminPath ?? null, save, uploadImage, exit }),
    [content, session, save, uploadImage, exit],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode(): EditModeValue {
  const value = useContext(EditModeContext);
  if (!value) throw new Error("useEditMode must be used inside EditModeProvider");
  return value;
}

/** The edited value for this spot, or the built-in default. */
export function useSiteText(key: string, fallback: string): string {
  return useEditMode().content[key] ?? fallback;
}
