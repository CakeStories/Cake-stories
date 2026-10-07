import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/button";

// Marthandam, Kanniyakumari district, Tamil Nadu — sensible default center
// for a shop that only delivers around this area.
const DEFAULT_CENTER: [number, number] = [8.2833, 77.2167];

declare global {
  interface Window {
    L?: any;
  }
}

let leafletLoadPromise: Promise<void> | null = null;

const LEAFLET_CSS_SRI = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const LEAFLET_JS_SRI = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

/** Loads the Leaflet CSS + JS bundle from CDN once, reusing the same promise on repeat calls. */
function loadLeaflet(): Promise<void> {
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    // The JS alone renders a broken, unstyled tangle of tiles — the
    // stylesheet is what actually positions and sizes everything.
    if (!document.querySelector("link[data-leaflet-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = LEAFLET_CSS_SRI;
      link.crossOrigin = "";
      link.setAttribute("data-leaflet-css", "true");
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    // Pinned hashes: the browser refuses the file if the CDN ever serves anything else.
    script.integrity = LEAFLET_JS_SRI;
    script.crossOrigin = "";
    script.onload = () => resolve();
    script.onerror = () => {
      leafletLoadPromise = null; // let the next open retry
      reject(new Error("Couldn't load the map. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

export type PickedLocation = {
  address: string;
  lat: number;
  lng: number;
  pincode?: string;
  city?: string;
};

export function LocationPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: PickedLocation) => void;
  initial?: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [address, setAddress] = useState("Drag the pin, or search, to set your location…");
  const [resolvedLatLng, setResolvedLatLng] = useState<{ lat: number; lng: number }>({
    lat: initial?.lat ?? DEFAULT_CENTER[0],
    lng: initial?.lng ?? DEFAULT_CENTER[1],
  });
  const [resolvedParts, setResolvedParts] = useState<{ pincode?: string; city?: string }>({});
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ label: string; lat: number; lng: number }>
  >([]);

  const reverseGeocode = async (lat: number, lng: number) => {
    setAddress("Finding address…");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      );
      const data = await response.json();
      setAddress(data?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setResolvedParts({
        pincode: data?.address?.postcode,
        city:
          data?.address?.city ||
          data?.address?.town ||
          data?.address?.village ||
          data?.address?.suburb,
      });
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setResolvedParts({});
    }
    setResolvedLatLng({ lat, lng });
  };

  const moveMarker = (lat: number, lng: number) => {
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (mapInstanceRef.current) mapInstanceRef.current.setView([lat, lng], 16);
    void reverseGeocode(lat, lng);
  };

  // Set up the map once the dialog opens and Leaflet has loaded.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setReady(false);
    setLoadError(null);

    loadLeaflet()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const L = window.L;

        // Guard against re-initializing an already-mounted map (e.g. if the
        // dialog is closed and reopened without a full remount).
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const startLat = initial?.lat ?? DEFAULT_CENTER[0];
        const startLng = initial?.lng ?? DEFAULT_CENTER[1];

        const map = L.map(mapRef.current).setView([startLat, startLng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          moveMarker(pos.lat, pos.lng);
        });
        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          moveMarker(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setReady(true);
        void reverseGeocode(startLat, startLng);

        // Leaflet needs a nudge to size itself correctly once the dialog's
        // enter animation finishes and the container has its real size.
        window.setTimeout(() => map.invalidateSize(), 200);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load the map.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tear the map down when the dialog closes, so reopening builds it fresh.
  useEffect(() => {
    if (open) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
    setSearchResults([]);
    setSearchQuery("");
  }, [open]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setAddress("Your browser doesn't support location — search or drag the pin instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        moveMarker(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
        setAddress("Couldn't get your location — search or drag the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await response.json();
      setSearchResults(
        (Array.isArray(data) ? data : []).map((item: any) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        })),
      );
    } catch {
      setAddress("Search failed — try dragging the pin instead.");
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = (result: { label: string; lat: number; lng: number }) => {
    setSearchResults([]);
    setSearchQuery("");
    moveMarker(result.lat, result.lng);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-xl font-normal">
            Pin your delivery location
          </DialogTitle>
        </div>

        <div className="p-5">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="Search for your area, street, or landmark"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
              {searchResults.length > 0 && (
                <ul className="absolute z-[1000] mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  {searchResults.map((result, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => pickSearchResult(result)}
                        className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                      >
                        {result.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={searching}
              onClick={() => void runSearch()}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={locating}
              onClick={useMyLocation}
              aria-label="Use my current location"
            >
              {locating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LocateFixed size={16} />
              )}
            </Button>
          </div>

          <div className="relative mt-3 h-80 w-full overflow-hidden rounded-md border border-border bg-muted">
            <div ref={mapRef} className="h-full w-full" />
            {!ready && !loadError && (
              <div className="absolute inset-0 grid place-items-center bg-muted/80">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={15} className="animate-spin" /> Loading map…
                </p>
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 grid place-items-center bg-muted/90 px-6 text-center">
                <p className="text-sm text-destructive">{loadError}</p>
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tap or drag the pin to the exact spot.
          </p>

          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">{address}</div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!ready}
            onClick={() => {
              onConfirm({
                address,
                lat: resolvedLatLng.lat,
                lng: resolvedLatLng.lng,
                ...resolvedParts,
              });
              onOpenChange(false);
            }}
          >
            Confirm location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
