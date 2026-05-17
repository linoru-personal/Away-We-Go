-- Allow trip owner and admins (can_edit_trip_metadata) to delete trips.
-- Editors/viewers remain unable to delete the whole trip row.

drop policy if exists trips_delete on public.trips;

create policy trips_delete on public.trips
  for delete to authenticated
  using (public.can_edit_trip_metadata(id));
