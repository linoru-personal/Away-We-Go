"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface PlacesMapFitBoundsProps {
  places: Array<{ lat: number; lng: number }>;
}

/** Fits the map bounds to include all place markers. */
export function PlacesMapFitBounds({ places }: PlacesMapFitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (places.length < 2) return;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...places.map((p) => p.lat)), Math.min(...places.map((p) => p.lng))],
      [Math.max(...places.map((p) => p.lat)), Math.max(...places.map((p) => p.lng))],
    ];
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [map, places]);

  return null;
}
