-- Phase 2: Permission helper functions for trip roles (admin, editor, viewer).
-- Used by RLS in later phases. No policy changes in this migration.
-- Assumes: trip_members.role exists (Phase 1), is_trip_owner(uuid), has_trip_access(uuid) exist.

-- 1) can_manage_trip_sharing(p_trip_id): true if owner or admin member (add/remove members, set role)
create or replace function public.can_manage_trip_sharing(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

-- 2) can_edit_trip_metadata(p_trip_id): true if owner or admin (trip row, participants, cover)
create or replace function public.can_edit_trip_metadata(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

-- 3) can_edit_trip_content(p_trip_id): true if owner, admin, or editor (tasks, notes, packing, etc.)
create or replace function public.can_edit_trip_content(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role in ('admin', 'editor')
     );
$$;

grant execute on function public.can_manage_trip_sharing(uuid) to authenticated;
grant execute on function public.can_edit_trip_metadata(uuid) to authenticated;
grant execute on function public.can_edit_trip_content(uuid) to authenticated;
