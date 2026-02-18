-- Private bucket for trip cover images. Path format: {trip_id}/cover.jpg
-- RLS on trips already restricts who can read/update trips; storage policies
-- restrict who can read/upload objects by trip ownership or membership.

insert into storage.buckets (id, name, public)
values ('trip-covers', 'trip-covers', false)
on conflict (id) do update set public = false;

-- SELECT: allow read if user is trip owner or trip member (has_trip_access)
create policy "trip_covers_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

-- INSERT: allow upload only if user is trip owner
create policy "trip_covers_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-covers'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

-- UPDATE: allow overwrite (e.g. upsert) only if user is trip owner
create policy "trip_covers_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

-- DELETE: allow delete only if user is trip owner
create policy "trip_covers_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );
