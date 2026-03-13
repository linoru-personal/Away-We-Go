"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { TripPlace } from "@/components/places/place-card";
import type { PlaceCategory } from "@/components/places/add-place-dialog";
import { CategoryIcon, getIconKey, PLACES_DEFAULT_ICON } from "@/components/ui/category-icons";
import { parseCoordsFromGoogleMapsUrl } from "@/lib/parse-google-maps-url";

import "leaflet/dist/leaflet.css";

const GENERAL_KEY = "__general__";

/** Distinct colors for categories (General gets the last). */
const CATEGORY_COLORS = [
  "#d97b5e",
  "#4a90a4",
  "#7cb342",
  "#f9a825",
  "#ab47bc",
  "#5c6bc0",
  "#ef5350",
  "#26a69a",
  "#8d6e63", // General / uncategorized
];

/** Place with resolved coordinates (from DB or parsed from Google Maps URL). */
type PlaceWithCoords = TripPlace & { lat: number; lng: number };

export type PlaceWithCoordsAndColor = PlaceWithCoords & { color: string; categoryKey: string };

function resolveCoords(place: TripPlace): PlaceWithCoords | null {
  if (place.lat != null && place.lng != null && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    return { ...place, lat: place.lat, lng: place.lng };
  }
  const parsed = place.google_maps_url ? parseCoordsFromGoogleMapsUrl(place.google_maps_url) : null;
  if (parsed) return { ...place, lat: parsed.lat, lng: parsed.lng };
  return null;
}

/** Fix default marker icon in Next.js (Leaflet icon paths break with webpack). */
function useLeafletIconFix() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const L = require("leaflet");
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);
}

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const PlacesMapContent = dynamic(
  () => import("@/components/places/places-map-content").then((m) => m.PlacesMapContent),
  { ssr: false }
);

export type MapViewCategoryGroup = {
  key: string;
  label: string;
  color: string;
  icon: string | null;
  places: PlaceWithCoords[];
};

export interface PlacesMapViewProps {
  places: TripPlace[];
  categories: PlaceCategory[];
  className?: string;
}

/** Renders an OpenStreetMap map with markers for places that have coordinates (from DB or parsed from Google Maps URL). */
export function PlacesMapView({ places, categories, className = "" }: PlacesMapViewProps) {
  useLeafletIconFix();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState<Set<string>>(new Set());

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsedCategoryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const placesWithCoords = useMemo(() => {
    const resolved: PlaceWithCoords[] = [];
    for (const p of places) {
      const withCoords = resolveCoords(p);
      if (withCoords) resolved.push(withCoords);
    }
    return resolved;
  }, [places]);

  const categoryKeyToColor = useMemo(() => {
    const m = new Map<string, string>();
    m.set(GENERAL_KEY, CATEGORY_COLORS[CATEGORY_COLORS.length - 1]);
    categories.forEach((cat, i) => {
      m.set(cat.id, CATEGORY_COLORS[i % (CATEGORY_COLORS.length - 1)] ?? CATEGORY_COLORS[0]);
    });
    return m;
  }, [categories]);

  const groups = useMemo((): MapViewCategoryGroup[] => {
    const uncategorized = placesWithCoords.filter((p) => !p.category_id);
    const result: MapViewCategoryGroup[] = [];
    if (uncategorized.length > 0) {
      result.push({
        key: GENERAL_KEY,
        label: "General",
        color: categoryKeyToColor.get(GENERAL_KEY)!,
        icon: null,
        places: uncategorized,
      });
    }
    const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    for (const cat of sortedCats) {
      const catPlaces = placesWithCoords.filter((p) => p.category_id === cat.id);
      if (catPlaces.length > 0) {
        result.push({
          key: cat.id,
          label: cat.name,
          color: categoryKeyToColor.get(cat.id)!,
          icon: cat.icon,
          places: catPlaces,
        });
      }
    }
    return result;
  }, [placesWithCoords, categories, categoryKeyToColor]);

  const allCategoryKeys = useMemo(() => groups.map((g) => g.key), [groups]);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<Set<string>>(() => new Set());
  const hasInitializedCategories = useRef(false);
  useEffect(() => {
    if (allCategoryKeys.length > 0 && !hasInitializedCategories.current) {
      hasInitializedCategories.current = true;
      setSelectedCategoryKeys(new Set(allCategoryKeys));
    }
  }, [allCategoryKeys]);

  const toggleCategory = useCallback((key: string) => {
    setSelectedCategoryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategoryKeys(new Set(allCategoryKeys));
  }, [allCategoryKeys]);

  const placesToShowOnMap = useMemo((): PlaceWithCoordsAndColor[] => {
    return placesWithCoords
      .filter((p) => {
        const key = p.category_id ?? GENERAL_KEY;
        return selectedCategoryKeys.has(key);
      })
      .map((p) => ({
        ...p,
        color: categoryKeyToColor.get(p.category_id ?? GENERAL_KEY) ?? CATEGORY_COLORS[0],
        categoryKey: p.category_id ?? GENERAL_KEY,
      }));
  }, [placesWithCoords, selectedCategoryKeys, categoryKeyToColor]);

  const center = useMemo(() => {
    if (placesToShowOnMap.length === 0) return { lat: 0, lng: 0 };
    if (placesToShowOnMap.length === 1)
      return { lat: placesToShowOnMap[0].lat, lng: placesToShowOnMap[0].lng };
    return {
      lat: placesToShowOnMap.reduce((s, p) => s + p.lat, 0) / placesToShowOnMap.length,
      lng: placesToShowOnMap.reduce((s, p) => s + p.lng, 0) / placesToShowOnMap.length,
    };
  }, [placesToShowOnMap]);

  if (placesWithCoords.length === 0) {
    return (
      <div
        className={`flex min-h-[280px] items-center justify-center rounded-2xl border border-[#ebe5df] bg-[#faf8f6] p-6 text-center ${className}`}
      >
        <p className="text-sm text-[#8a8a8a]">
          No places with location data to show on the map. Add places with Google Maps links that include coordinates.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[320px] w-full overflow-hidden rounded-2xl border border-[#ebe5df] ${className}`}
    >
      <div className="flex w-72 shrink-0 flex-col border-r border-[#ebe5df] bg-[#faf8f6]">
        <div className="flex flex-col gap-2 border-b border-[#ebe5df] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#4A4A4A]">Places by category</h2>
          {groups.length > 1 && (
            <button
              type="button"
              onClick={selectAllCategories}
              className="text-left text-xs font-medium text-[#6b6b6b] hover:text-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset"
            >
              Select all categories
            </button>
          )}
          {placesToShowOnMap.length > 1 && (
            <button
              type="button"
              onClick={() => setSelectedPlaceId(null)}
              className={`text-left text-sm font-medium text-[#d97b5e] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset ${
                selectedPlaceId === null ? "underline" : ""
              }`}
            >
              Show full map
            </button>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto py-2" role="list">
          {groups.map((group) => {
            const isCollapsed = collapsedCategoryKeys.has(group.key);
            return (
              <li key={group.key} className="mb-4">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(group.key)}
                    className="shrink-0 rounded p-0.5 text-[#6b6b6b] hover:text-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset"
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? "Expand category" : "Collapse category"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.key)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#c4b8ab] bg-white focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
                    aria-checked={selectedCategoryKeys.has(group.key)}
                    role="checkbox"
                  >
                    {selectedCategoryKeys.has(group.key) && (
                      <span className="text-[10px] text-[#2d2d2d]" aria-hidden>✓</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(group.key)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset"
                  >
                    <span className="shrink-0 text-[#4A4A4A]">
                      <CategoryIcon
                        iconKey={getIconKey(group.icon, PLACES_DEFAULT_ICON)}
                        size={18}
                      />
                    </span>
                    <span className="truncate text-sm font-medium text-[#4A4A4A]">{group.label}</span>
                    {group.places.length > 0 && (
                      <span className="shrink-0 text-xs text-[#8a8a8a]">({group.places.length})</span>
                    )}
                  </button>
                </div>
                {!isCollapsed && (
                  <ul className="mt-0.5" role="list">
                    {group.places.map((place) => (
                      <li key={place.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlaceId(place.id)}
                          className={`flex w-full items-center gap-2 px-4 py-2 pl-16 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset ${
                            selectedPlaceId === place.id
                              ? "bg-[#d97b5e]/15 font-medium text-[#c46950]"
                              : "text-[#2d2d2d] hover:bg-[#f0ebe6]"
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                            aria-hidden
                          />
                          {place.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-w-0 flex-1 [&_.leaflet-container]:rounded-r-2xl [&_.leaflet-container]:h-full">
        {placesToShowOnMap.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center rounded-r-2xl bg-[#faf8f6] px-6 text-center">
            <p className="text-sm text-[#8a8a8a]">
              Select at least one category above to see places on the map.
            </p>
          </div>
        ) : (
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={placesToShowOnMap.length === 1 ? 14 : 10}
            className="h-[320px] w-full"
            scrollWheelZoom={true}
            aria-label="Map of trip places"
          >
            <PlacesMapContent
              placesWithCoords={placesToShowOnMap}
              selectedPlaceId={selectedPlaceId}
            />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
