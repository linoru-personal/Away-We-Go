-- Optional destination image for trip dashboard hero (storage path in trip-covers bucket).
alter table public.trips
  add column if not exists destination_image_url text;
