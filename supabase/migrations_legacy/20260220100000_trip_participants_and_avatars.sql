-- Trip participants (names + optional avatar) per trip. Avatars stored in private bucket.
-- Assumes: public.is_trip_owner(uuid), public.has_trip_access(uuid) exist.

-- 1) trip_participants table
create table if not exists public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  avatar_path text,
  sort_order int4 not null default 0
);

create index if not exists idx_trip_participants_trip_id on public.trip_participants(trip_id);
alter table public.trip_participants enable row level security;

-- Make policies idempotent (safe to rerun)
drop policy if exists "trip_participants_select" on public.trip_participants;
create policy "trip_participants_select"
  on public.trip_participants for select to authenticated
  using (public.has_trip_access(trip_id));

drop policy if exists "trip_participants_insert" on public.trip_participants;
create policy "trip_participants_insert"
  on public.trip_participants for insert to authenticated
  with check (public.is_trip_owner(trip_id));

drop policy if exists "trip_participants_update" on public.trip_participants;
create policy "trip_participants_update"
  on public.trip_participants for update to authenticated
  using (public.is_trip_owner(trip_id));

drop policy if exists "trip_participants_delete" on public.trip_participants;
create policy "trip_participants_delete"
  on public.trip_participants for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- 2) Avatars bucket (private). Path format: {trip_id}/{participant_id}.jpg
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

-- Storage RLS: first path segment = trip_id
drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );