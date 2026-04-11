import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripMediaVariantPaths } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";

const LEGACY_AVATARS_BUCKET = "avatars";
const LEGACY_TRIP_COVERS_BUCKET = "trip-covers";

export function variantPathsToObjectKeys(paths: TripMediaVariantPaths): string[] {
  return [paths.original, paths.preview, paths.thumb];
}

export async function removeTripMediaObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(TRIP_MEDIA_BUCKET).remove(paths);
}

export async function removeAvatarsBucketObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  const cleaned = paths.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return;
  await supabase.storage.from(LEGACY_AVATARS_BUCKET).remove(cleaned);
}

export async function removeTripCoversBucketObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  const cleaned = paths.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return;
  await supabase.storage.from(LEGACY_TRIP_COVERS_BUCKET).remove(cleaned);
}
