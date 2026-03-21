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

/**
 * True for Google Maps short links that need redirect resolution before
 * {@link parseCoordsFromGoogleMapsUrl} / /place/... name extraction can run.
 * Full google.com/maps URLs are false here so they keep the existing client-only flow.
 */
export function isGoogleMapsShortUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  let host: string;
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl" || host === "www.goo.gl") {
    return trimmed.toLowerCase().includes("/maps");
  }
  return false;
}
