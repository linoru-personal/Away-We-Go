-- Add taken_at (EXIF or fallback) and sort_at for chronological ordering (oldest first).
alter table public.trip_photos
  add column if not exists taken_at timestamptz;

comment on column public.trip_photos.taken_at is 'When the photo was taken (EXIF when available, else null; sort uses created_at fallback).';

alter table public.trip_photos
  add column if not exists sort_at timestamptz generated always as (coalesce(taken_at, created_at)) stored;

create index if not exists idx_trip_photos_trip_sort_at on public.trip_photos(trip_id, sort_at asc);

-- Drop the old desc index so default listing uses sort_at; keep trip_id index.
drop index if exists public.idx_trip_photos_created_at_desc;
