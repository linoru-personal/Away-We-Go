/**
 * Canonical `trip_photos.media` jsonb shape and helpers for gallery assets in `trip-media`.
 * Paths: `{tripId}/photos/{photoId}/thumb.webp` | `display.webp` (no revision segment).
 */

import { TRIP_MEDIA_BUCKET } from "@/lib/trip-media/types";

const THUMB_FILENAME = "thumb.webp" as const;
const DISPLAY_FILENAME = "display.webp" as const;

/** One variant entry stored under `trip_photos.media.variants`. */
export type TripPhotosVariantEntry = {
  bucket: typeof TRIP_MEDIA_BUCKET;
  path: string;
  width: number;
  height: number;
};

/** Full `trip_photos.media` document for gallery rows (source of truth for Storage locations). */
export type TripPhotosMedia = {
  variants: {
    thumb: TripPhotosVariantEntry;
    display: TripPhotosVariantEntry;
  };
};

export type TripPhotosMediaDimensions = {
  width: number;
  height: number;
};

export type CreateTripPhotosMediaInput = {
  tripId: string;
  photoId: string;
  thumb: TripPhotosMediaDimensions;
  display: TripPhotosMediaDimensions;
};

/**
 * Object key under bucket `trip-media` for the thumbnail variant.
 * `{tripId}/photos/{photoId}/thumb.webp`
 */
export function galleryThumbPath(tripId: string, photoId: string): string {
  return `${tripId}/photos/${photoId}/${THUMB_FILENAME}`;
}

/**
 * Object key under bucket `trip-media` for the display variant.
 * `{tripId}/photos/{photoId}/display.webp`
 */
export function galleryDisplayPath(tripId: string, photoId: string): string {
  return `${tripId}/photos/${photoId}/${DISPLAY_FILENAME}`;
}

/**
 * Prefix for all objects belonging to one gallery photo (useful for delete-by-prefix).
 * `{tripId}/photos/{photoId}/`
 */
export function galleryPhotoObjectPrefix(tripId: string, photoId: string): string {
  return `${tripId}/photos/${photoId}/`;
}

/**
 * Builds `trip_photos.media` after variants are generated (dimensions from Sharp/metadata).
 */
export function createTripPhotosMedia(input: CreateTripPhotosMediaInput): TripPhotosMedia {
  const { tripId, photoId, thumb, display } = input;
  return {
    variants: {
      thumb: {
        bucket: TRIP_MEDIA_BUCKET,
        path: galleryThumbPath(tripId, photoId),
        width: thumb.width,
        height: thumb.height,
      },
      display: {
        bucket: TRIP_MEDIA_BUCKET,
        path: galleryDisplayPath(tripId, photoId),
        width: display.width,
        height: display.height,
      },
    },
  };
}

function isPositiveFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isTripPhotosVariantEntry(value: unknown): value is TripPhotosVariantEntry {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.bucket === TRIP_MEDIA_BUCKET &&
    typeof v.path === "string" &&
    v.path.trim().length > 0 &&
    isPositiveFiniteNumber(v.width) &&
    isPositiveFiniteNumber(v.height)
  );
}

/** Narrowing guard for JSON parsed from `trip_photos.media`. */
export function isTripPhotosMedia(value: unknown): value is TripPhotosMedia {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const variants = v.variants;
  if (variants === null || typeof variants !== "object") return false;
  const vr = variants as Record<string, unknown>;
  return (
    isTripPhotosVariantEntry(vr.thumb) &&
    isTripPhotosVariantEntry(vr.display)
  );
}
