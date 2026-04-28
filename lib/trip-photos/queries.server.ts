import { supabase } from "@/app/lib/supabaseServer";

/**
 * See `lib/trip-photos/queries.ts` — legacy `image_path` may exist in DB but is omitted here.
 */
export type TripPhotoRow = {
  id: string;
  trip_id: string;
  added_by_user_id: string;
  caption: string | null;
  created_at: string;
  taken_at: string | null;
  sort_at: string;
  media?: unknown;
};

/**
 * Returns all trip_photos for a trip, oldest first (by sort_at). Server-only.
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
