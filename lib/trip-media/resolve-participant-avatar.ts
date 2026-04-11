import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripCoverVariant } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";
import {
  readPartialVariantPathsAt,
  resolveVariantStoragePath,
} from "./variant-paths";
import { createSignedUrlForCoverLocation } from "./resolve-cover";

const LEGACY_AVATAR_BUCKET = "avatars";

export type ParticipantAvatarRowLike = {
  media?: unknown;
  avatar_path?: string | null;
};

export function pickParticipantAvatarStorageLocation(
  row: ParticipantAvatarRowLike,
  requestedVariant: TripCoverVariant
): { bucket: string; path: string } | null {
  const partial = readPartialVariantPathsAt(row.media, ["avatar"]);
  if (partial) {
    const path = resolveVariantStoragePath(partial, requestedVariant);
    if (path) return { bucket: TRIP_MEDIA_BUCKET, path };
  }
  const legacy = row.avatar_path;
  if (legacy && typeof legacy === "string" && legacy.trim()) {
    return { bucket: LEGACY_AVATAR_BUCKET, path: legacy.trim() };
  }
  return null;
}

/**
 * Default tier is **thumb** (lists / small circles). Use **preview** for larger UI.
 */
export async function getParticipantAvatarDisplayUrl(
  supabase: SupabaseClient,
  row: ParticipantAvatarRowLike,
  variant: TripCoverVariant = "thumb",
  expiresInSeconds = 3600
): Promise<string | null> {
  const loc = pickParticipantAvatarStorageLocation(row, variant);
  if (!loc) return null;
  return createSignedUrlForCoverLocation(
    supabase,
    loc,
    expiresInSeconds,
    variant
  );
}
