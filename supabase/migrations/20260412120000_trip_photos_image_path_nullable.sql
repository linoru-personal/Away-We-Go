-- Photos gallery: allow rows where variant paths live only in trip_photos.media (trip-media bucket).
-- Existing rows keep non-null image_path values unchanged.

alter table public.trip_photos
  alter column image_path drop not null;

comment on column public.trip_photos.image_path is
  'Legacy storage key (historically trip-photos). Nullable so new gallery rows can rely solely on trip_photos.media variant paths under trip-media. Intended source of truth for new Photos rows: media jsonb.';
