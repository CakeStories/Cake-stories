import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabaseRest } from "@/lib/supabase";
import { applySitewideDiscount } from "@/lib/pricing";

export type StoreSettings = {
  announcementText: string;
  announcementCouponCode: string | null;
  announcementActive: boolean;
  sitewideDiscountPercent: number | null;
  sitewideDiscountActive: boolean;
  birthdayDeliveryEstimate: string;
  defaultDeliveryEstimate: string;
  /** Ordered list of Birthday Cake tab names, set from /manage. Empty = tab rail is hidden. */
  birthdayTabs: string[];
};

const DEFAULT_SETTINGS: StoreSettings = {
  announcementText:
    "Freshly baked happiness, delivered across Tamil Nadu · Free delivery above ₹999",
  announcementCouponCode: null,
  announcementActive: true,
  sitewideDiscountPercent: null,
  sitewideDiscountActive: false,
  birthdayDeliveryEstimate: "90-120 mins",
  defaultDeliveryEstimate: "24 hours",
  birthdayTabs: [],
};

type Row = {
  announcement_text: string;
  announcement_coupon_code: string | null;
  announcement_active: boolean;
  sitewide_discount_percent: number | string | null;
  sitewide_discount_active: boolean;
  birthday_delivery_estimate: string | null;
  default_delivery_estimate: string | null;
  birthday_tabs: string[] | null;
};

async function fetchStoreSettings(): Promise<StoreSettings> {
  const rows = await supabaseRest<Row>("store_settings", {
    select:
      "announcement_text,announcement_coupon_code,announcement_active,sitewide_discount_percent,sitewide_discount_active,birthday_delivery_estimate,default_delivery_estimate,birthday_tabs",
  });
  const row = rows[0];
  if (!row) return DEFAULT_SETTINGS;

  return {
    announcementText: row.announcement_text || DEFAULT_SETTINGS.announcementText,
    announcementCouponCode: row.announcement_coupon_code,
    announcementActive: row.announcement_active,
    sitewideDiscountPercent:
      row.sitewide_discount_percent != null ? Number(row.sitewide_discount_percent) : null,
    sitewideDiscountActive: row.sitewide_discount_active,
    birthdayDeliveryEstimate:
      row.birthday_delivery_estimate || DEFAULT_SETTINGS.birthdayDeliveryEstimate,
    defaultDeliveryEstimate:
      row.default_delivery_estimate || DEFAULT_SETTINGS.defaultDeliveryEstimate,
    birthdayTabs: Array.isArray(row.birthday_tabs) ? row.birthday_tabs : [],
  };
}

/**
 * Given a base price (and that item's own "was" price, if any), applies the
 * sitewide discount when one is active. A sitewide sale takes over the
 * display uniformly — including for products that already have their own
 * per-item offer — since "run X% off everything" is meant to be the
 * headline price everywhere while it's on.
 */
export function withSitewideDiscount(
  price: number,
  mrp: number | null | undefined,
  settings: StoreSettings,
): { price: number; mrp: number | null | undefined } {
  if (settings.sitewideDiscountActive && settings.sitewideDiscountPercent) {
    return { price: applySitewideDiscount(price, settings.sitewideDiscountPercent), mrp: price };
  }
  return { price, mrp };
}

const StoreSettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    fetchStoreSettings()
      .then((fetched) => {
        if (!cancelled) setSettings(fetched);
      })
      .catch(() => {
        // Keep the defaults — a settings hiccup should never break the site.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => settings, [settings]);

  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings(): StoreSettings {
  return useContext(StoreSettingsContext);
}
