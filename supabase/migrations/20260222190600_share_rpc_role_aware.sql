-- Role-aware sharing RPCs: allow owner or admin (can_manage_trip_sharing), support role, return role.
-- Assumes: can_manage_trip_sharing(uuid), trip_members.role exist. Owner remains trips.user_id only.

-- 1) share_trip(p_trip_id, p_email [, p_role])
-- Guard: can_manage_trip_sharing. Optional p_role (default 'viewer'); validate admin/editor/viewer.
-- Do not add the trip owner to trip_members. Preserve "do not leak whether email exists" message.
create or replace function public.share_trip(p_trip_id uuid, p_email text, p_role text default 'viewer')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_owner_id uuid;
  v_message text := 'If that user has an account, they have been added to the trip.';
  v_role text := coalesce(nullif(trim(lower(p_role)), ''), 'viewer');
begin
  if not public.can_manage_trip_sharing(p_trip_id) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  if v_role not in ('admin', 'editor', 'viewer') then
    return jsonb_build_object('ok', false, 'message', 'Invalid role. Use admin, editor, or viewer.');
  end if;

  select user_id into v_owner_id from public.trips where id = p_trip_id limit 1;

  select id into v_user_id
  from auth.users
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is not null and v_user_id <> v_owner_id then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, v_user_id, v_role)
    on conflict (trip_id, user_id) do update set role = excluded.role;
  end if;

  return jsonb_build_object('ok', true, 'message', v_message);
end;
$$;

-- 2) unshare_trip(p_trip_id, p_user_id)
-- Guard: can_manage_trip_sharing. Do not allow removing the trip owner (owner is not in trip_members; block if p_user_id = trips.user_id).
create or replace function public.unshare_trip(p_trip_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if not public.can_manage_trip_sharing(p_trip_id) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  select user_id into v_owner_id from public.trips where id = p_trip_id limit 1;
  if p_user_id = v_owner_id then
    return jsonb_build_object('ok', false, 'message', 'Cannot remove the trip owner.');
  end if;

  delete from public.trip_members
  where trip_id = p_trip_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 3) get_trip_members(p_trip_id)
-- Guard: can_manage_trip_sharing. Return user_id, email, role for UI to show members and roles.
-- Drop first so we can change return type (add role) if the old function already exists.
drop function if exists public.get_trip_members(uuid);

create or replace function public.get_trip_members(p_trip_id uuid)
returns table(user_id uuid, email text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select m.user_id, u.email::text, m.role::text
  from public.trip_members m
  join auth.users u on u.id = m.user_id
  where m.trip_id = p_trip_id
    and public.can_manage_trip_sharing(p_trip_id);
$$;

grant execute on function public.share_trip(uuid, text, text) to authenticated;
grant execute on function public.unshare_trip(uuid, uuid) to authenticated;
grant execute on function public.get_trip_members(uuid) to authenticated;
