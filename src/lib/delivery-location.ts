import { useEffect, useState } from "react";

/**
 * The "Delivering to" choice from the header, remembered in localStorage so
 * checkout can prefill the customer's pincode and city from it.
 */

export const BRANCH_LOCATIONS = [
  {
    id: "anducode",
    label: "Anducode",
    address: "Post Office Jn, Melpuram Arumanai Road",
    phone: "+91 89030 18447",
    mapsUrl: "https://share.google/tnwKStx0Ccg18KDul",
  },
  {
    id: "pammam",
    label: "Pammam",
    address: "One Stop Supermarket Building, NH 47 Trivandrum Main Road, Marthandam",
    phone: "+91 97467 63777",
    mapsUrl: "https://share.google/S27MxcUvVy0D80oFe",
  },
  {
    id: "marthandam",
    label: "North Street, Marthandam",
    address: "Near Good Shepherd School, North Street",
    phone: "+91 96330 20980",
    mapsUrl: "https://share.google/Mm441BndGDFrD7hUE",
  },
];

const STORAGE_KEY = "cake-stories:location";

export type DeliveryLocation = {
  id: string;
  label: string;
  address?: string;
  pincode?: string;
  city?: string;
  phone?: string;
  mapsUrl?: string;
};

export function readSavedDeliveryLocation(): DeliveryLocation | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    // Older saved values were just the branch id as a bare string.
    const branch = BRANCH_LOCATIONS.find((l) => l.id === stored);
    if (branch) return branch;
    const parsed = JSON.parse(stored) as DeliveryLocation;
    return parsed?.label ? parsed : null;
  } catch {
    return null; // storage blocked, or a stale format
  }
}

export function useDeliveryLocation() {
  const [location, setLocationState] = useState<DeliveryLocation>(BRANCH_LOCATIONS[0]!);

  useEffect(() => {
    const saved = readSavedDeliveryLocation();
    if (saved) setLocationState(saved);
  }, []);

  const setLocation = (next: DeliveryLocation) => {
    setLocationState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const setBranch = (id: string) => {
    const branch = BRANCH_LOCATIONS.find((l) => l.id === id);
    if (branch) setLocation(branch);
  };

  /** Looks up a 6-digit Indian PIN code via India Post's public API and sets the delivery location to its area. */
  const setByPincode = async (
    pincode: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!/^\d{6}$/.test(pincode)) {
      return { ok: false, message: "Enter a valid 6-digit pincode." };
    }
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      if (!response.ok) throw new Error("lookup failed");
      const data = (await response.json()) as Array<{
        Status: string;
        PostOffice: Array<{ Name: string; District: string; State: string }> | null;
      }>;
      const postOffice = data[0]?.PostOffice?.[0];
      if (data[0]?.Status !== "Success" || !postOffice) {
        return {
          ok: false,
          message: "Couldn't find that pincode — check the number and try again.",
        };
      }
      setLocation({
        id: `pincode-${pincode}`,
        label: `${postOffice.District}, ${postOffice.State}`,
        address: `PIN ${pincode} — ${postOffice.Name}`,
        pincode,
        city: postOffice.District,
      });
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Couldn't look up that pincode right now — check your connection and try again.",
      };
    }
  };

  return { location, setBranch, setByPincode };
}
