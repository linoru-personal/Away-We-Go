-- Trip Places: user-added places (e.g. from Google Maps links). App is source of truth.
-- RLS via public.has_trip_access(trip_id).

create table if not exists public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  added_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  google_maps_url text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_places_trip_id on public.trip_places(trip_id);
create index if not exists idx_trip_places_trip_id_created_at on public.trip_places(trip_id, created_at desc);

alter table public.trip_places enable row level security;

create policy "trip_places_select"
  on public.trip_places for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_places_insert"
  on public.trip_places for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_places_update"
  on public.trip_places for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_places_delete"
  on public.trip_places for delete to authenticated
  using (public.has_trip_access(trip_id));
