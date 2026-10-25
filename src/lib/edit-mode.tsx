import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { fetchSiteContent, type SiteContent } from "@/lib/site-content";
import { setWhatsAppNumber } from "@/lib/whatsapp";
import { clearReadCache } from "@/lib/supabase";
import {
  adminSaveSiteContent,
  adminUpdateBanner,
  adminUpdateCategory,
  adminUpdateProduct,
  adminUpdateStoreSettings,
  adminUploadSiteImage,
} from "@/lib/admin.server";

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
  /** Writes a cake's name / description / photo / badge straight to the catalogue. */
  saveProduct: (productId: string, patch: ProductPatch) => Promise<void>;
  /** Renames a category (or changes its banner line) in the catalogue. */
  saveCategory: (categoryId: string, patch: { name?: string; bannerText?: string | null }) => Promise<void>;
  /** Swaps a banner's photo (homepage or category page). */
  saveBannerImage: (bannerId: string, imageUrl: string) => Promise<void>;
  /** The announcement strip and delivery-time wording from Store & offers. */
  saveStoreSettings: (patch: StorePatch) => Promise<void>;
  exit: () => void;
};

type StorePatch = {
  announcementText?: string;
  birthdayDeliveryEstimate?: string;
  defaultDeliveryEstimate?: string;
};

type ProductPatch = {
  name?: string;
  description?: string | null;
  badge?: string | null;
  delivery_estimate?: string | null;
  image_url?: string;
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
  // Every "Enquire on WhatsApp" link reads this; set during render so server and browser agree.
  setWhatsAppNumber(content["contact.whatsapp"]);

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

  const queryClient = useQueryClient();
  const router = useRouter();
  /** After a catalogue change, re-read everything so every page shows it. */
  const refreshCatalogue = useCallback(async () => {
    clearReadCache();
    await queryClient.invalidateQueries();
    await router.invalidate();
  }, [queryClient, router]);

  const saveProduct = useCallback(
    async (productId: string, patch: ProductPatch) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      await adminUpdateProduct({ data: { token: session.token, productId, ...patch } });
      await refreshCatalogue();
    },
    [session, refreshCatalogue],
  );

  const saveCategory = useCallback(
    async (categoryId: string, patch: { name?: string; bannerText?: string | null }) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      await adminUpdateCategory({ data: { token: session.token, categoryId, ...patch } });
      await refreshCatalogue();
    },
    [session, refreshCatalogue],
  );

  const saveBannerImage = useCallback(
    async (bannerId: string, imageUrl: string) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      await adminUpdateBanner({ data: { token: session.token, bannerId, imageUrl } });
      await refreshCatalogue();
    },
    [session, refreshCatalogue],
  );

  const saveStoreSettings = useCallback(
    async (patch: StorePatch) => {
      if (!session) throw new Error("Sign in on the admin page first.");
      await adminUpdateStoreSettings({ data: { token: session.token, ...patch } });
      await refreshCatalogue();
    },
    [session, refreshCatalogue],
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
    () => ({
      content,
      editing: session != null,
      adminPath: session?.adminPath ?? null,
      save,
      uploadImage,
      saveProduct,
      saveCategory,
      saveStoreSettings,
      saveBannerImage,
      exit,
    }),
    [content, session, save, uploadImage, saveProduct, saveCategory, saveStoreSettings, saveBannerImage, exit],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

const notEditing = async () => {
  throw new Error("The website editor isn't available here.");
};

/** Outside the provider (e.g. the root error page) everything just shows its built-in wording. */
const NO_EDITOR: EditModeValue = {
  content: {},
  editing: false,
  adminPath: null,
  save: notEditing,
  uploadImage: notEditing,
  saveProduct: notEditing,
  saveCategory: notEditing,
  saveStoreSettings: notEditing,
  saveBannerImage: notEditing,
  exit: () => {},
};

export function useEditMode(): EditModeValue {
  return useContext(EditModeContext) ?? NO_EDITOR;
}

/** The edited value for this spot, or the built-in default. */
export function useSiteText(key: string, fallback: string): string {
  return useEditMode().content[key] ?? fallback;
}
