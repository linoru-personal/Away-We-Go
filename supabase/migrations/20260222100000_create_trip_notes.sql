-- Trip Notes: trip-scoped notes with title, structured content (jsonb), optional tags.
-- Reuses public.has_trip_access(uuid); no new helpers. RLS matches tasks pattern.

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  content jsonb,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_notes_trip_id on public.trip_notes(trip_id);
create index if not exists idx_trip_notes_trip_id_created_at on public.trip_notes(trip_id, created_at desc);

alter table public.trip_notes enable row level security;

create policy "trip_notes_select"
  on public.trip_notes for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_notes_insert"
  on public.trip_notes for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_notes_update"
  on public.trip_notes for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_notes_delete"
  on public.trip_notes for delete to authenticated
  using (public.has_trip_access(trip_id));
