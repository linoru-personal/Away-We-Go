-- Add nullable Google place fields for future Places MVP. Backward compatible.

alter table public.trip_places
  add column if not exists google_place_id text,
  add column if not exists formatted_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;
