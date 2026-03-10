-- Phase 3: Core RLS — trips, trip_members, trip_participants.
-- Enforces: edit metadata = owner or admin; manage sharing = owner or admin.
-- No new tables; no change to trip delete (remains owner-only).
-- Assumes: can_edit_trip_metadata(uuid), can_manage_trip_sharing(uuid) exist.

-- 1) trips: update restricted to owner or admin (metadata only)
drop policy if exists "trips_update" on public.trips;
create policy "trips_update"
  on public.trips for update to authenticated
  using (public.can_edit_trip_metadata(id));

-- 2) trip_members: insert/update/delete restricted to owner or admin
drop policy if exists "trip_members_insert" on public.trip_members;
create policy "trip_members_insert"
  on public.trip_members for insert to authenticated
  with check (public.can_manage_trip_sharing(trip_id));

drop policy if exists "trip_members_delete" on public.trip_members;
create policy "trip_members_delete"
  on public.trip_members for delete to authenticated
  using (public.can_manage_trip_sharing(trip_id));

-- Allow owner/admin to change member role (e.g. upgrade viewer to editor)
create policy "trip_members_update"
  on public.trip_members for update to authenticated
  using (public.can_manage_trip_sharing(trip_id))
  with check (public.can_manage_trip_sharing(trip_id));

-- 3) trip_participants: insert/update/delete restricted to owner or admin (trip metadata)
drop policy if exists "trip_participants_insert" on public.trip_participants;
create policy "trip_participants_insert"
  on public.trip_participants for insert to authenticated
  with check (public.can_edit_trip_metadata(trip_id));

drop policy if exists "trip_participants_update" on public.trip_participants;
create policy "trip_participants_update"
  on public.trip_participants for update to authenticated
  using (public.can_edit_trip_metadata(trip_id))
  with check (public.can_edit_trip_metadata(trip_id));

drop policy if exists "trip_participants_delete" on public.trip_participants;
create policy "trip_participants_delete"
  on public.trip_participants for delete to authenticated
  using (public.can_edit_trip_metadata(trip_id));
