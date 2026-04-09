-- Private bucket for trip photos. Path format: {trip_id}/{photo_id}.{ext}
-- Reuses has_trip_access(uuid); any user with trip access can read/upload/update/delete.

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do update set public = false;

create policy "trip_photos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_photos_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "trip_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );
