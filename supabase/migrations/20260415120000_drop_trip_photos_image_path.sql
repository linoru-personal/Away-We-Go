-- Gallery rows use trip_photos.media + trip-media; image_path was legacy storage keys.
-- Safe after app code stopped reading/writing this column.

alter table public.trip_photos drop column if exists image_path;
