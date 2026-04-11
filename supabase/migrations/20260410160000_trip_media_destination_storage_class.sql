-- Allow `destination` as second path segment under bucket trip-media (trips.media.destination).
-- Matches metadata edit permission used for cover / participants / editable.

drop policy if exists "trip_media_insert_authenticated" on storage.objects;
drop policy if exists "trip_media_update_authenticated" on storage.objects;
drop policy if exists "trip_media_delete_authenticated" on storage.objects;

create policy "trip_media_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable', 'destination')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);

create policy "trip_media_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable', 'destination')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
)
with check (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable', 'destination')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);

create policy "trip_media_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable', 'destination')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);

comment on function public.trip_storage_object_class(text) is
  'NEW: Extract class segment (second path component: cover|participants|photos|editable|destination) from storage object key.';
