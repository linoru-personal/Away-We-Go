/**
 * Canonical shape for trip cover assets stored under bucket `trip-media`
 * and referenced from `public.trips.media` (jsonb).
 */

export const TRIP_MEDIA_BUCKET = "trip-media" as const;

/** Storage object keys relative to `trip-media` bucket. */
export type TripMediaCoverPaths = {
  original: string;
  preview: string;
  thumb: string;
};

export type TripMediaCover = {
  paths: TripMediaCoverPaths;
};

/** Known keys; other keys may exist and must be preserved on merge. */
export type TripMedia = {
  cover?: TripMediaCover | null;
  [key: string]: unknown;
};

export type TripCoverVariant = "original" | "preview" | "thumb";
