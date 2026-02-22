-- Private bucket for trip note images. Path format: {trip_id}/{timestamp}-{filename}
-- Reuses has_trip_access(uuid); any user with trip access can read/upload.

insert into storage.buckets (id, name, public)
values ('trip-notes', 'trip-notes', false)
on conflict (id) do update set public = false;

create policy "trip_notes_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-notes'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_notes_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-notes'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_notes_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-notes'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_notes_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-notes'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );
