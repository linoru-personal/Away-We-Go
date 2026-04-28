import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIP_MEDIA_BUCKET } from "@/lib/trip-media/types";
import { isTripPhotosMedia } from "@/lib/trip-photos/media";
import type { TripPhotoRow } from "@/lib/trip-photos/queries";
import type { PhotoWithUrl } from "@/lib/trip-photos/gallery-types";

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Maps DB rows to gallery UI props: signs thumb (+ display) in `trip-media` using `trip_photos.media`.
 * Rows without valid `media` or failed thumb signing are omitted.
 */
export async function mapTripPhotosToGalleryUrls(
  supabase: SupabaseClient,
  photos: TripPhotoRow[]
): Promise<PhotoWithUrl[]> {
  const mapped = await Promise.all(
    photos.map((p) => tripPhotoRowToGalleryWithUrls(supabase, p))
  );
  return mapped.filter((x): x is PhotoWithUrl => x !== null);
}

/**
 * Like `mapTripPhotosToGalleryUrls` but signs **`thumb` only** (no `display`).
 * For dashboard previews / thumbnails where full-size URLs are unused.
 */
export async function mapTripPhotosToGalleryThumbUrls(
  supabase: SupabaseClient,
  photos: TripPhotoRow[]
): Promise<PhotoWithUrl[]> {
  const mapped = await Promise.all(
    photos.map((p) => tripPhotoRowToGalleryThumbOnlyWithUrls(supabase, p))
  );
  return mapped.filter((x): x is PhotoWithUrl => x !== null);
}

async function tripPhotoRowToGalleryThumbOnlyWithUrls(
  supabase: SupabaseClient,
  p: TripPhotoRow
): Promise<PhotoWithUrl | null> {
  if (!isTripPhotosMedia(p.media)) return null;

  const { thumb } = p.media.variants;
  if (thumb.bucket !== TRIP_MEDIA_BUCKET) return null;

  const thumbRes = await supabase.storage
    .from(TRIP_MEDIA_BUCKET)
    .createSignedUrl(thumb.path, SIGNED_URL_TTL_SECONDS);

  const thumbUrl = thumbRes.data?.signedUrl ?? "";
  if (!thumbUrl) return null;

  return {
    id: p.id,
    trip_id: p.trip_id,
    caption: p.caption,
    created_at: p.created_at,
    thumbUrl,
  };
}

async function tripPhotoRowToGalleryWithUrls(
  supabase: SupabaseClient,
  p: TripPhotoRow
): Promise<PhotoWithUrl | null> {
  if (!isTripPhotosMedia(p.media)) return null;

  const { thumb, display } = p.media.variants;
  if (
    thumb.bucket !== TRIP_MEDIA_BUCKET ||
    display.bucket !== TRIP_MEDIA_BUCKET
  ) {
    return null;
  }

  const [thumbRes, displayRes] = await Promise.all([
    supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .createSignedUrl(thumb.path, SIGNED_URL_TTL_SECONDS),
    supabase.storage
      .from(TRIP_MEDIA_BUCKET)
      .createSignedUrl(display.path, SIGNED_URL_TTL_SECONDS),
  ]);

  const thumbUrl = thumbRes.data?.signedUrl ?? "";
  const displayUrl = displayRes.data?.signedUrl ?? "";

  if (!thumbUrl) return null;

  const base: PhotoWithUrl = {
    id: p.id,
    trip_id: p.trip_id,
    caption: p.caption,
    created_at: p.created_at,
    thumbUrl,
  };

  if (displayUrl) {
    return { ...base, displayUrl };
  }

  return base;
}
