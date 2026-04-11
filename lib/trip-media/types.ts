/**
 * Canonical shapes for trip assets in bucket `trip-media` and referenced from
 * `public.trips.media` / `public.trip_participants.media` (jsonb).
 */

export const TRIP_MEDIA_BUCKET = "trip-media" as const;

/** Storage object keys relative to `trip-media` bucket (three tiers). */
export type TripMediaVariantPaths = {
  original: string;
  preview: string;
  thumb: string;
};

/** @deprecated alias — same shape as all tiered trip-media assets */
export type TripMediaCoverPaths = TripMediaVariantPaths;

export type TripMediaCover = {
  paths: TripMediaVariantPaths;
};

export type TripMediaDestination = {
  paths: TripMediaVariantPaths;
};

/** Known keys on `trips.media`; other keys may exist and must be preserved on merge. */
export type TripMedia = {
  cover?: TripMediaCover | null;
  destination?: TripMediaDestination | null;
  [key: string]: unknown;
};

/** `trip_participants.media` — avatar tiered paths. */
export type TripParticipantMedia = {
  avatar?: { paths: TripMediaVariantPaths } | null;
  [key: string]: unknown;
};

export type TripCoverVariant = "original" | "preview" | "thumb";
