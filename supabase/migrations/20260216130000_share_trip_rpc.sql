-- RPCs for trip sharing (owner-only share/unshare; owner-only member list with email)
-- Assumes: is_trip_owner(uuid), trip_members table and RLS exist.

-- share_trip: add member by email. Owner only. Does not leak whether email exists.
create or replace function public.share_trip(p_trip_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_message text := 'If that user has an account, they have been added to the trip.';
begin
  if not public.is_trip_owner(p_trip_id) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  select id into v_user_id
  from auth.users
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is not null then
    insert into public.trip_members (trip_id, user_id)
    values (p_trip_id, v_user_id)
    on conflict (trip_id, user_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'message', v_message);
end;
$$;

-- unshare_trip: remove member. Owner only.
create or replace function public.unshare_trip(p_trip_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_owner(p_trip_id) then
    return jsonb_build_object('ok', false);
  end if;

  delete from public.trip_members
  where trip_id = p_trip_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- get_trip_members: list members with email for owner (so UI can show emails without exposing auth.users to client)
create or replace function public.get_trip_members(p_trip_id uuid)
returns table(user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select m.user_id, u.email::text
  from public.trip_members m
  join auth.users u on u.id = m.user_id
  where m.trip_id = p_trip_id
    and public.is_trip_owner(p_trip_id);
$$;

grant execute on function public.share_trip(uuid, text) to authenticated;
grant execute on function public.unshare_trip(uuid, uuid) to authenticated;
grant execute on function public.get_trip_members(uuid) to authenticated;
