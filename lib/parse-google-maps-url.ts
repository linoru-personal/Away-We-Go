/**
 * Parses latitude and longitude from a Google Maps URL.
 * Supports URLs like:
 *   https://www.google.com/maps/place/.../@46.6681796,12.396874,17z
 *   https://www.google.com/maps/@46.6681796,12.396874,17z
 *   https://maps.google.com/.../@-33.8688,151.2093,17z
 * Pattern: /@LAT,LNG or /@LAT,LNG,ZOOMz
 */
export function parseCoordsFromGoogleMapsUrl(
  url: string
): { lat: number; lng: number } | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const match = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
