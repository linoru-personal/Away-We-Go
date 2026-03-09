-- Trip Photos: trip-scoped photos with storage path and optional caption.
-- RLS via public.has_trip_access(trip_id).

create table if not exists public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  added_by_user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_photos_trip_id on public.trip_photos(trip_id);
create index if not exists idx_trip_photos_created_at_desc on public.trip_photos(created_at desc);

alter table public.trip_photos enable row level security;

create policy "trip_photos_select"
  on public.trip_photos for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_photos_insert"
  on public.trip_photos for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_photos_update"
  on public.trip_photos for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_photos_delete"
  on public.trip_photos for delete to authenticated
  using (public.has_trip_access(trip_id));
