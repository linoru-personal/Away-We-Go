import { supabase } from "@/app/lib/supabaseClient";

/**
 * `trip_photos` row as used by the app (`select('*')`). The database may still have a legacy
 * `image_path` column until a future migration drops it; app code does not read or write it.
 */
export type TripPhotoRow = {
  id: string;
  trip_id: string;
  added_by_user_id: string;
  caption: string | null;
  created_at: string;
  taken_at: string | null;
  sort_at: string;
  /** Gallery variants (`trip-media` paths). Source of truth for new uploads. */
  media?: unknown;
};

/**
 * Page size for the trip Photos gallery (initial + each "Load more").
 */
export const TRIP_PHOTOS_PAGE_SIZE = 24;

/**
 * Returns all trip_photos for a trip, oldest first by `sort_at` (same ordering as paginated gallery).
 */
export async function getTripPhotos(tripId: string): Promise<TripPhotoRow[]> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripPhotoRow[];
}

export type TripPhotosPageResult = {
  photos: TripPhotoRow[];
  /** Total rows for this trip (for offset pagination). */
  totalCount: number;
};

/**
 * One page of `trip_photos` for the gallery: oldest first by `sort_at`, range/offset pagination.
 */
export async function getTripPhotosPage(
  tripId: string,
  offset: number,
  limit: number = TRIP_PHOTOS_PAGE_SIZE
): Promise<TripPhotosPageResult> {
  const from = Math.max(0, offset);
  const to = from + limit - 1;
  const { data, error, count } = await supabase
    .from("trip_photos")
    .select("*", { count: "exact" })
    .eq("trip_id", tripId)
    .order("sort_at", { ascending: true })
    .range(from, to);
  if (error) throw new Error(error.message);
  return {
    photos: (data ?? []) as TripPhotoRow[],
    totalCount: count ?? 0,
  };
}

export type TripPhotosPreview = {
  photos: TripPhotoRow[];
  totalCount: number;
};

/** Max photos to fetch for dashboard preview (8 visible slots + rotation pool). */
const PREVIEW_PHOTO_LIMIT = 32;

/**
 * Returns the latest photos (by sort_at) for dashboard preview and the total count.
 * Fetches up to PREVIEW_PHOTO_LIMIT so the summary card can show many thumbnails and rotate through more.
 */
export async function getTripPhotosPreview(
  tripId: string
): Promise<TripPhotosPreview> {
  const { data, error, count } = await supabase
    .from("trip_photos")
    .select("*", { count: "exact" })
    .eq("trip_id", tripId)
    .order("sort_at", { ascending: false })
    .range(0, PREVIEW_PHOTO_LIMIT - 1);
  if (error) throw new Error(error.message);
  return {
    photos: (data ?? []) as TripPhotoRow[],
    totalCount: count ?? 0,
  };
}
