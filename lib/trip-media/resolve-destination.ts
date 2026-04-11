import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripCoverVariant } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";
import {
  readPartialVariantPathsAt,
  resolveVariantStoragePath,
} from "./variant-paths";
import { createSignedUrlForCoverLocation } from "./resolve-cover";

const LEGACY_DESTINATION_BUCKET = "trip-covers";

export type DestinationImageRowLike = {
  media?: unknown;
  destination_image_url?: string | null;
};

export function pickDestinationStorageLocation(
  row: DestinationImageRowLike,
  requestedVariant: TripCoverVariant
): { bucket: string; path: string } | null {
  const partial = readPartialVariantPathsAt(row.media, ["destination"]);
  if (partial) {
    const path = resolveVariantStoragePath(partial, requestedVariant);
    if (path) return { bucket: TRIP_MEDIA_BUCKET, path };
  }
  const legacy = row.destination_image_url;
  if (legacy && typeof legacy === "string" && legacy.trim()) {
    return { bucket: LEGACY_DESTINATION_BUCKET, path: legacy.trim() };
  }
  return null;
}

/**
 * Default tier is **preview** (never original). Legacy `destination_image_url` is one object in trip-covers.
 */
export async function getTripDestinationDisplayUrl(
  supabase: SupabaseClient,
  row: DestinationImageRowLike,
  variant: TripCoverVariant = "preview",
  expiresInSeconds = 3600
): Promise<string | null> {
  const loc = pickDestinationStorageLocation(row, variant);
  if (!loc) return null;
  return createSignedUrlForCoverLocation(
    supabase,
    loc,
    expiresInSeconds,
    variant
  );
}
