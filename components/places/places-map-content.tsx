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

function createCircleIcon(color: string) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  return L.divIcon({
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
          icon={createCircleIcon(place.color)}
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
