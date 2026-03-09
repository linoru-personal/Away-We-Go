import { supabase } from "@/app/lib/supabaseClient";

export type TripPhotoRow = {
  id: string;
  trip_id: string;
  added_by_user_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
};

/**
 * Returns all trip_photos for a trip, newest first.
 */
export async function getTripPhotos(tripId: string): Promise<TripPhotoRow[]> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripPhotoRow[];
}

export type TripPhotosPreview = {
  photos: TripPhotoRow[];
  totalCount: number;
};

/**
 * Returns the latest 3 photos and the total count for a trip.
 */
export async function getTripPhotosPreview(
  tripId: string
): Promise<TripPhotosPreview> {
  const { data, error, count } = await supabase
    .from("trip_photos")
    .select("*", { count: "exact" })
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .range(0, 2);
  if (error) throw new Error(error.message);
  return {
    photos: (data ?? []) as TripPhotoRow[],
    totalCount: count ?? 0,
  };
}
