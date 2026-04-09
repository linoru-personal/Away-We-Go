-- Add cover image path for trip covers stored in private storage (trip-covers bucket).
-- Path format: {trip_id}/cover.jpg

alter table public.trips
  add column if not exists cover_image_path text;
