import {
  galleryDisplayPath,
  galleryPhotoObjectPrefix,
  galleryThumbPath,
  isTripPhotosMedia,
} from "@/lib/trip-photos/media";

/**
 * Object paths to remove in `trip-media` for one gallery photo.
 * Always includes canonical `{tripId}/photos/{photoId}/thumb.webp` and `display.webp`.
 * When `media` is valid, also includes variant paths from JSON if they live under the same prefix.
 */
export function galleryPhotoStoragePathsToRemove(
  tripId: string,
  photoId: string,
  media: unknown
): string[] {
  const prefix = galleryPhotoObjectPrefix(tripId, photoId);
  const canonical = [
    galleryThumbPath(tripId, photoId),
    galleryDisplayPath(tripId, photoId),
  ];
  const set = new Set(canonical);

  if (isTripPhotosMedia(media)) {
    for (const p of [media.variants.thumb.path, media.variants.display.path]) {
      if (
        typeof p === "string" &&
        p.trim().length > 0 &&
        p.startsWith(prefix)
      ) {
        set.add(p);
      }
    }
  }

  return Array.from(set);
}
