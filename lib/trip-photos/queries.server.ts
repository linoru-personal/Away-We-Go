import { supabase } from "@/app/lib/supabaseServer";

export type TripPhotoRow = {
  id: string;
  trip_id: string;
  added_by_user_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
};

/**
 * Returns all trip_photos for a trip, newest first. Server-only.
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
