-- Trip Place Categories: optional per-trip categories for places. RLS via public.has_trip_access(trip_id).

create table if not exists public.trip_place_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now(),
  unique (trip_id, name)
);

create index if not exists idx_trip_place_categories_trip_id on public.trip_place_categories(trip_id);

alter table public.trip_place_categories enable row level security;

create policy "trip_place_categories_select"
  on public.trip_place_categories for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_place_categories_insert"
  on public.trip_place_categories for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_place_categories_update"
  on public.trip_place_categories for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_place_categories_delete"
  on public.trip_place_categories for delete to authenticated
  using (public.has_trip_access(trip_id));

-- Add optional category to places
alter table public.trip_places
  add column if not exists category_id uuid references public.trip_place_categories(id) on delete set null;

create index if not exists idx_trip_places_category_id on public.trip_places(category_id);
