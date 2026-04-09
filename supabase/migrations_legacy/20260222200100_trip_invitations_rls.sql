-- RLS for trip_invitations. Only owner/admin (can_manage_trip_sharing) can manage invitations.
-- Invited users do NOT get table access; acceptance must go through a secure RPC.
-- No DELETE policy: revoke via status/revoked_at update.

alter table public.trip_invitations enable row level security;

-- SELECT: only users who can manage sharing for the trip see its invitations
create policy "trip_invitations_select"
  on public.trip_invitations for select to authenticated
  using (public.can_manage_trip_sharing(trip_id));

-- INSERT: only users who can manage sharing can create invitations; must set invited_by = self
create policy "trip_invitations_insert"
  on public.trip_invitations for insert to authenticated
  with check (
    public.can_manage_trip_sharing(trip_id)
    and invited_by = auth.uid()
  );

-- UPDATE: only users who can manage sharing can update (e.g. revoke, expire)
create policy "trip_invitations_update"
  on public.trip_invitations for update to authenticated
  using (public.can_manage_trip_sharing(trip_id))
  with check (public.can_manage_trip_sharing(trip_id));

-- No DELETE policy: invitations are revoked via status/revoked_at, not hard-deleted.
