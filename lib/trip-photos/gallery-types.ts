/**
 * Trip Photos gallery UI row after signing URLs from `trip_photos.media` (`trip-media`).
 */
export type PhotoWithUrl = {
  id: string;
  trip_id: string;
  caption: string | null;
  created_at: string;
  /** Signed URL for `media.variants.thumb` — grid thumbnails. */
  thumbUrl: string;
  /** Signed URL for `media.variants.display` — lightbox / fullscreen when wired. */
  displayUrl?: string;
};
