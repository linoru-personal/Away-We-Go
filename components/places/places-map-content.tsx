"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { TileLayer, Marker, Popup } from "react-leaflet";
import { PlacesMapFitBounds } from "@/components/places/places-map-fit-bounds";

const OPENSTREETMAP_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type PlaceWithCoordsAndColor = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  google_maps_url: string;
  color: string;
};

type LeafletMarker = { openPopup: () => void };

function createPinIcon(color: string) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  const escaped = color.replace(/"/g, "'");
  return L.divIcon({
    html: `<div style="width:28px;height:36px;position:relative;"><svg viewBox="0 0 24 36" width="28" height="36" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35));"><path d="M12 2C7.58 2 4 5.58 4 10c0 6 8 14 8 14s8-8 8-14c0-4.42-3.58-8-8-8z" fill="${escaped}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

export interface PlacesMapContentProps {
  placesWithCoords: PlaceWithCoordsAndColor[];
  selectedPlaceId: string | null;
}

export function PlacesMapContent({ placesWithCoords, selectedPlaceId }: PlacesMapContentProps) {
  const map = useMap();
  const markerRefs = useRef<Record<string, LeafletMarker | null>>({});

  useEffect(() => {
    if (!selectedPlaceId) return;
    const place = placesWithCoords.find((p) => p.id === selectedPlaceId);
    if (!place) return;
    map.flyTo([place.lat, place.lng], 15, { duration: 0.35 });
    const marker = markerRefs.current[selectedPlaceId];
    if (marker?.openPopup) {
      const t = setTimeout(() => marker.openPopup(), 400);
      return () => clearTimeout(t);
    }
  }, [selectedPlaceId, placesWithCoords, map]);

  useEffect(() => {
    if (selectedPlaceId !== null) return;
    if (placesWithCoords.length < 2) return;
    const bounds: [[number, number], [number, number]] = [
      [
        Math.min(...placesWithCoords.map((p) => p.lat)),
        Math.min(...placesWithCoords.map((p) => p.lng)),
      ],
      [
        Math.max(...placesWithCoords.map((p) => p.lat)),
        Math.max(...placesWithCoords.map((p) => p.lng)),
      ],
    ];
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    if (typeof map.closePopup === "function") map.closePopup();
  }, [selectedPlaceId, placesWithCoords, map]);

  return (
    <>
      <TileLayer
        attribution={OPENSTREETMAP_ATTR}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PlacesMapFitBounds
        places={placesWithCoords.map((p) => ({ lat: p.lat, lng: p.lng }))}
      />
      {placesWithCoords.map((place) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          title={place.title}
          icon={createPinIcon(place.color)}
          ref={(m) => {
            if (m) (markerRefs.current[place.id] = m as unknown as LeafletMarker);
          }}
        >
          <Popup>
            <span className="font-medium">{place.title}</span>
            {place.google_maps_url && (
              <a
                href={place.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-[#d97b5e] hover:underline"
              >
                Open in Google Maps
              </a>
            )}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
