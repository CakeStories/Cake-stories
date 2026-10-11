import { useEffect, useState } from "react";
import { CAKE_DELIVERY_PINCODES, CAKE_DELIVERY_RADIUS_KM } from "@/lib/pricing";

/**
 * The "Delivering to" choice from the header, remembered in localStorage so
 * checkout can prefill the customer's pincode and city from it.
 */

export const BRANCH_LOCATIONS = [
  {
    id: "anducode",
    label: "Anducode",
    pickupBranch: "Arumanai Main Road, Anducode", // its name in checkout's pickup list
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
    pickupBranch: "North Street, Marthandam",
    address: "Near Good Shepherd School, North Street",
    phone: "+91 96330 20980",
    mapsUrl: "https://share.google/Mm441BndGDFrD7hUE",
  },
];

const STORAGE_KEY = "cake-stories:location";

/** Shown until the customer picks an area or a shop. */
const NO_LOCATION: DeliveryLocation = { id: "none", label: "Choose your area" };

/** True when the customer chose to pick up from one of our shops (rather than a delivery pincode). */
export function isPickupLocation(location: { id: string }): boolean {
  return BRANCH_LOCATIONS.some((shop) => shop.id === location.id);
}

/** The checkout pickup-branch name for a shop chosen in the header, if that shop offers pickup. */
export function pickupBranchFor(location: { id: string }): string | undefined {
  const shop: { id: string; pickupBranch?: string } | undefined = BRANCH_LOCATIONS.find(
    (b) => b.id === location.id,
  );
  return shop?.pickupBranch;
}

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
  const [location, setLocationState] = useState<DeliveryLocation>(NO_LOCATION);

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

  /**
   * Sets the delivery location from a 6-digit PIN code — but only inside our
   * cake delivery area (within 15 km of Marthandam; the same pincode list
   * checkout uses). Outside it, nothing is saved and the customer is told we
   * can't deliver there. India Post's public API supplies the area name.
   */
  const setByPincode = async (
    pincode: string,
  ): Promise<{ ok: true } | { ok: false; message: string; notDeliverable?: true }> => {
    if (!/^\d{6}$/.test(pincode)) {
      return { ok: false, message: "Enter a valid 6-digit pincode." };
    }
    if (!CAKE_DELIVERY_PINCODES.has(pincode)) {
      return {
        ok: false,
        notDeliverable: true,
        message: `Not deliverable to this location. We deliver cakes within ${CAKE_DELIVERY_RADIUS_KM} km of Marthandam — you can still order for store pickup.`,
      };
    }
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("lookup failed");
      const data = (await response.json()) as Array<{
        Status: string;
        PostOffice: Array<{ Name: string; District: string; State: string }> | null;
      }>;
      const postOffice = data[0]?.PostOffice?.[0];
      setLocation({
        id: `pincode-${pincode}`,
        label: postOffice ? `${postOffice.Name} · ${pincode}` : `PIN ${pincode}`,
        address: postOffice ? `${postOffice.Name}, ${postOffice.District} ${pincode}` : `PIN ${pincode}`,
        pincode,
        city: postOffice?.District ?? "",
      });
      return { ok: true };
    } catch {
      // The pincode is already known to be in our area — the lookup only
      // supplies a nicer name, so accept it even if India Post is down.
      setLocation({ id: `pincode-${pincode}`, label: `PIN ${pincode}`, pincode });
      return { ok: true };
    }
  };

  return { location, setBranch, setByPincode };
}
