-- Bucket for editable image assets: original + cropped per asset.
-- Path structure: {trip_id}/{owner_type}/{asset_id}/original.{ext} and .../cropped.jpg
-- For avatar: {trip_id}/participant_avatar/{participant_id}/{asset_id}/original.{ext} and .../cropped.jpg
-- First path segment is trip_id for RLS. Uses same permission model as trip-covers.

insert into storage.buckets (id, name, public)
values ('editable-images', 'editable-images', false)
on conflict (id) do update set public = false;

create policy "editable_images_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'editable-images'
    and public.has_trip_access((storage.foldername(name))[1]::uuid)
  );

create policy "editable_images_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'editable-images'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

create policy "editable_images_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'editable-images'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );

create policy "editable_images_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'editable-images'
    and public.is_trip_owner((storage.foldername(name))[1]::uuid)
  );
