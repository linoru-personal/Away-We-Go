import type { TripMedia, TripMediaCover, TripMediaCoverPaths } from "./types";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parsePaths(raw: unknown): TripMediaCoverPaths | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const original = o.original;
  const preview = o.preview;
  const thumb = o.thumb;
  if (!isNonEmptyString(original) || !isNonEmptyString(preview) || !isNonEmptyString(thumb)) {
    return null;
  }
  return { original, preview, thumb };
}

/** Returns a validated cover object or null (missing, null, or malformed). */
export function parseTripMediaCoverFromRow(media: unknown): TripMediaCover | null {
  if (media == null) return null;
  if (typeof media !== "object" || Array.isArray(media)) return null;
  const m = media as Record<string, unknown>;
  const coverRaw = m.cover;
  if (coverRaw == null) return null;
  if (typeof coverRaw !== "object" || Array.isArray(coverRaw)) return null;
  const paths = parsePaths((coverRaw as Record<string, unknown>).paths);
  if (!paths) return null;
  return { paths };
}

/** True if the row has any persisted cover (new `media.cover`, legacy path, or legacy public URL). */
export function tripHasPersistedCover(
  trip:
    | { media?: unknown; cover_image_path?: string | null; cover_image_url?: string | null }
    | null
    | undefined
): boolean {
  if (!trip) return false;
  if (parseTripMediaCoverFromRow(trip.media ?? null)) return true;
  if (typeof trip.cover_image_path === "string" && trip.cover_image_path.trim().length > 0)
    return true;
  if (typeof trip.cover_image_url === "string" && trip.cover_image_url.trim().length > 0)
    return true;
  return false;
}

/** Safe parse of full `trips.media` jsonb; never throws. */
export function parseTripMedia(media: unknown): TripMedia {
  if (media == null || typeof media !== "object" || Array.isArray(media)) {
    return {};
  }
  const obj = { ...(media as Record<string, unknown>) };
  const cover = parseTripMediaCoverFromRow({ cover: obj.cover });
  if (cover) obj.cover = cover;
  else delete obj.cover;
  return obj as TripMedia;
}
