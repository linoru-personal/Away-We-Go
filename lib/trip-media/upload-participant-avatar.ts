import type { SupabaseClient } from "@supabase/supabase-js";
import { buildParticipantAvatarWebpVariants } from "./image-variants";
import { parseParticipantMediaAvatarFromRow } from "./parse";
import type { TripMediaVariantPaths } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";
import {
  removeAvatarsBucketObjects,
  removeTripMediaObjects,
  variantPathsToObjectKeys,
} from "./storage-helpers";

const WEBP = "image/webp";

/**
 * Upload avatar WebP tiers to `trip-media`, set `trip_participants.media.avatar` only,
 * null `avatar_path`. Rolls back new objects on DB failure; removes prior trip-media
 * avatar + legacy `avatars` object after success.
 */
export async function uploadParticipantAvatarToMedia(
  supabase: SupabaseClient,
  params: { tripId: string; participantId: string; sourceImage: Blob }
): Promise<{ paths: TripMediaVariantPaths }> {
  const { tripId, participantId, sourceImage } = params;
  const variants = await buildParticipantAvatarWebpVariants(sourceImage);
  const fileId = crypto.randomUUID();
  const paths: TripMediaVariantPaths = {
    original: `${tripId}/participants/original/${fileId}.webp`,
    preview: `${tripId}/participants/preview/${fileId}.webp`,
    thumb: `${tripId}/participants/thumb/${fileId}.webp`,
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
      .from("trip_participants")
      .select("media, avatar_path")
      .eq("trip_id", tripId)
      .eq("id", participantId)
      .single();
    if (selErr) throw new Error(selErr.message);

    const rawMedia = row?.media;
    const base: Record<string, unknown> =
      rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
        ? { ...(rawMedia as Record<string, unknown>) }
        : {};
    const previousAvatar = parseParticipantMediaAvatarFromRow(rawMedia);
    const previousPaths = previousAvatar?.paths;
    const previousLegacyPath =
      typeof row?.avatar_path === "string" && row.avatar_path.trim()
        ? row.avatar_path.trim()
        : null;

    const nextMedia = { ...base, avatar: { paths } };
    const { error: updErr } = await supabase
      .from("trip_participants")
      .update({ media: nextMedia, avatar_path: null })
      .eq("trip_id", tripId)
      .eq("id", participantId);
    if (updErr) throw new Error(updErr.message);

    if (previousPaths) {
      void removeTripMediaObjects(supabase, variantPathsToObjectKeys(previousPaths));
    }
    if (previousLegacyPath) {
      void removeAvatarsBucketObjects(supabase, [previousLegacyPath]);
    }

    return { paths };
  } catch (e) {
    await removeTripMediaObjects(supabase, done);
    throw e;
  }
}

export async function clearParticipantAvatarMediaAndLegacy(
  supabase: SupabaseClient,
  tripId: string,
  participantId: string
): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from("trip_participants")
    .select("media, avatar_path")
    .eq("trip_id", tripId)
    .eq("id", participantId)
    .single();
  if (selErr) throw new Error(selErr.message);

  const rawMedia = row?.media;
  const previous = parseParticipantMediaAvatarFromRow(rawMedia);
  const prevPaths = previous?.paths ? variantPathsToObjectKeys(previous.paths) : [];
  const legacyPath =
    typeof row?.avatar_path === "string" && row.avatar_path.trim()
      ? row.avatar_path.trim()
      : null;

  const base: Record<string, unknown> =
    rawMedia && typeof rawMedia === "object" && !Array.isArray(rawMedia)
      ? { ...(rawMedia as Record<string, unknown>) }
      : {};
  delete base.avatar;
  const nextMedia = Object.keys(base).length > 0 ? base : null;

  const { error: updErr } = await supabase
    .from("trip_participants")
    .update({ media: nextMedia, avatar_path: null })
    .eq("trip_id", tripId)
    .eq("id", participantId);
  if (updErr) throw new Error(updErr.message);

  if (prevPaths.length > 0) {
    void removeTripMediaObjects(supabase, prevPaths);
  }
  if (legacyPath) {
    void removeAvatarsBucketObjects(supabase, [legacyPath]);
  }
}
