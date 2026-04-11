import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTripCoverWebpVariants } from "./image-variants";
import { parseTripMediaCoverFromRow } from "./parse";
import type { TripMediaCoverPaths } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";

const WEBP = "image/webp";

function coverObjectPaths(paths: TripMediaCoverPaths): string[] {
  return [paths.original, paths.preview, paths.thumb];
}

async function removeStorageObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(TRIP_MEDIA_BUCKET).remove(paths);
}

/**
 * Upload three WebP variants to `trip-media`, then set `trips.media.cover` only.
 * Preserves other keys in `trips.media`. `upsert: false` on each upload.
 * On DB failure, removes the newly uploaded objects best-effort.
 * After DB success, best-effort deletes prior `media.cover` objects if they were in this bucket.
 */
export async function uploadTripCoverToMedia(
  supabase: SupabaseClient,
  params: { tripId: string; sourceImage: Blob }
): Promise<{ paths: TripMediaCoverPaths }> {
  const { tripId, sourceImage } = params;
  const variants = await buildTripCoverWebpVariants(sourceImage);
  const fileId = crypto.randomUUID();
  const paths: TripMediaCoverPaths = {
    original: `${tripId}/cover/original/${fileId}.webp`,
    preview: `${tripId}/cover/preview/${fileId}.webp`,
    thumb: `${tripId}/cover/thumb/${fileId}.webp`,
  };

  const uploads: { path: string; body: Blob }[] = [
    { path: paths.original, body: variants.original },
    { path: paths.preview, body: variants.preview },
    { path: paths.thumb, body: variants.thumb },
  ];

  const done: string[] = [];
  try {
    for (const u of uploads) {
      const { error } = await supabase.storage
        .from(TRIP_MEDIA_BUCKET)
        .upload(u.path, u.body, { upsert: false, contentType: WEBP });
      if (error) throw new Error(error.message);
      done.push(u.path);
    }

    const { data: row, error: selErr } = await supabase
      .from("trips")
      .select("media")
      .eq("id", tripId)
      .single();
    if (selErr) throw new Error(selErr.message);

    const rawMedia = row?.media;
    const base: Record<string, unknown> =
      rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
        ? { ...(rawMedia as Record<string, unknown>) }
        : {};
    const previousCover = parseTripMediaCoverFromRow(rawMedia);
    const previousPaths = previousCover?.paths;

    const nextMedia = { ...base, cover: { paths } };
    const { error: updErr } = await supabase
      .from("trips")
      .update({ media: nextMedia })
      .eq("id", tripId);
    if (updErr) throw new Error(updErr.message);

    if (previousPaths) {
      void removeStorageObjects(supabase, coverObjectPaths(previousPaths));
    }

    return { paths };
  } catch (e) {
    await removeStorageObjects(supabase, done);
    throw e;
  }
}

/**
 * Clear cover from `trips.media`, null legacy cover columns, remove prior trip-media cover objects.
 */
export async function clearTripCoverMediaAndLegacy(
  supabase: SupabaseClient,
  tripId: string
): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from("trips")
    .select("media")
    .eq("id", tripId)
    .single();
  if (selErr) throw new Error(selErr.message);

  const rawMedia = row?.media;
  const previous = parseTripMediaCoverFromRow(rawMedia);
  const prevPaths = previous?.paths ? coverObjectPaths(previous.paths) : [];

  const base: Record<string, unknown> =
    rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
      ? { ...(rawMedia as Record<string, unknown>) }
      : {};
  delete base.cover;
  const nextMedia = Object.keys(base).length > 0 ? base : null;

  const { error: updErr } = await supabase
    .from("trips")
    .update({
      media: nextMedia,
      cover_image_path: null,
      cover_image_url: null,
    })
    .eq("id", tripId);
  if (updErr) throw new Error(updErr.message);

  if (prevPaths.length > 0) {
    void removeStorageObjects(supabase, prevPaths);
  }
}
