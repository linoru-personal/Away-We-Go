import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTripCoverWebpVariants } from "./image-variants";
import { parseTripMediaDestinationFromRow } from "./parse";
import type { TripMediaVariantPaths } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";
import {
  removeTripCoversBucketObjects,
  removeTripMediaObjects,
  variantPathsToObjectKeys,
} from "./storage-helpers";

const WEBP = "image/webp";

/**
 * Upload three WebP hero variants to `trip-media` under `{tripId}/destination/…`,
 * merge `trips.media.destination`, clear legacy `destination_image_url`, remove prior files.
 */
export async function uploadTripDestinationToMedia(
  supabase: SupabaseClient,
  params: { tripId: string; sourceImage: Blob }
): Promise<{ paths: TripMediaVariantPaths }> {
  const { tripId, sourceImage } = params;
  const variants = await buildTripCoverWebpVariants(sourceImage);
  const fileId = crypto.randomUUID();
  const paths: TripMediaVariantPaths = {
    original: `${tripId}/destination/original/${fileId}.webp`,
    preview: `${tripId}/destination/preview/${fileId}.webp`,
    thumb: `${tripId}/destination/thumb/${fileId}.webp`,
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
      .select("media, destination_image_url")
      .eq("id", tripId)
      .single();
    if (selErr) throw new Error(selErr.message);

    const rawMedia = row?.media;
    const base: Record<string, unknown> =
      rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
        ? { ...(rawMedia as Record<string, unknown>) }
        : {};
    const previousDest = parseTripMediaDestinationFromRow(rawMedia);
    const previousDestPaths = previousDest?.paths;
    const previousLegacyUrl =
      typeof row?.destination_image_url === "string" && row.destination_image_url.trim()
        ? row.destination_image_url.trim()
        : null;

    const nextMedia = { ...base, destination: { paths } };
    const { error: updErr } = await supabase
      .from("trips")
      .update({ media: nextMedia, destination_image_url: null })
      .eq("id", tripId);
    if (updErr) throw new Error(updErr.message);

    if (previousDestPaths) {
      void removeTripMediaObjects(supabase, variantPathsToObjectKeys(previousDestPaths));
    }
    if (previousLegacyUrl) {
      void removeTripCoversBucketObjects(supabase, [previousLegacyUrl]);
    }

    return { paths };
  } catch (e) {
    await removeTripMediaObjects(supabase, done);
    throw e;
  }
}

export async function clearTripDestinationMediaAndLegacy(
  supabase: SupabaseClient,
  tripId: string
): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from("trips")
    .select("media, destination_image_url")
    .eq("id", tripId)
    .single();
  if (selErr) throw new Error(selErr.message);

  const rawMedia = row?.media;
  const previous = parseTripMediaDestinationFromRow(rawMedia);
  const prevTripMediaPaths = previous?.paths
    ? variantPathsToObjectKeys(previous.paths)
    : [];
  const legacyPath =
    typeof row?.destination_image_url === "string" && row.destination_image_url.trim()
      ? row.destination_image_url.trim()
      : null;

  const base: Record<string, unknown> =
    rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
      ? { ...(rawMedia as Record<string, unknown>) }
      : {};
  delete base.destination;
  const nextMedia = Object.keys(base).length > 0 ? base : null;

  const { error: updErr } = await supabase
    .from("trips")
    .update({ media: nextMedia, destination_image_url: null })
    .eq("id", tripId);
  if (updErr) throw new Error(updErr.message);

  if (prevTripMediaPaths.length > 0) {
    void removeTripMediaObjects(supabase, prevTripMediaPaths);
  }
  if (legacyPath) {
    void removeTripCoversBucketObjects(supabase, [legacyPath]);
  }
}
