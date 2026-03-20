import { supabase } from "@/app/lib/supabaseClient";

export type TripPhotoRow = {
  id: string;
  trip_id: string;
  added_by_user_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  taken_at: string | null;
  sort_at: string;
};

/**
 * Returns all trip_photos for a trip, oldest first (by taken_at when available, else created_at).
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
