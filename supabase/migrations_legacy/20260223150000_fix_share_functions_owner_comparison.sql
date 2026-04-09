-- Fix: `v_user_id <> v_owner_id` is NULL when v_owner_id is NULL, so PL/pgSQL treats the IF as false
-- and skips trip_members insert for existing users (silent failure / wrong branch).
-- Use IS DISTINCT FROM and require the trip row to exist before sharing.

create or replace function public.share_trip_with_invitation(
  p_trip_id uuid,
  p_email text,
  p_role text default 'viewer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_email_norm text;
  v_role text;
  v_owner_id uuid;
  v_user_id uuid;
  v_inv_id uuid;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  v_inviter uuid;
begin
  if not public.can_manage_trip_sharing(p_trip_id) then
    raise log 'share_trip_with_invitation: denied can_manage_trip_sharing trip_id=%', p_trip_id;
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  v_email_norm := lower(trim(p_email));
  if v_email_norm = '' then
    return jsonb_build_object('ok', false, 'message', 'Email is required.');
  end if;

  v_role := coalesce(nullif(trim(lower(p_role)), ''), 'viewer');
  if v_role not in ('admin', 'editor', 'viewer') then
    return jsonb_build_object('ok', false, 'message', 'Invalid role. Use admin, editor, or viewer.');
  end if;

  select t.user_id into v_owner_id
  from public.trips t
  where t.id = p_trip_id
  limit 1;

  if not found then
    raise log 'share_trip_with_invitation: trip not found trip_id=%', p_trip_id;
    return jsonb_build_object('ok', false, 'message', 'Trip not found.');
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(trim(u.email)) = v_email_norm
  limit 1;

  raise log 'share_trip_with_invitation: trip_id=% email_norm=% resolved_user_id=% owner_user_id=%',
    p_trip_id, v_email_norm, v_user_id, v_owner_id;

  -- Add member when invitee exists and is not the trip owner (NULL-safe compare)
  if v_user_id is not null and v_user_id is distinct from v_owner_id then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, v_user_id, v_role)
    on conflict (trip_id, user_id) do update set role = excluded.role;

    raise log 'share_trip_with_invitation: trip_members upsert trip_id=% member_user_id=% role=%',
      p_trip_id, v_user_id, v_role;

    update public.trip_invitations
    set status = 'revoked', revoked_at = now(), updated_at = now()
    where trip_id = p_trip_id and email_normalized = v_email_norm and status = 'pending';

    return jsonb_build_object(
      'ok', true,
      'outcome', 'member_added',
      'invitation_id', null,
      'invitation_token', null,
      'email_send_required', false
    );
  end if;

  -- No auth user yet, or invitee is the owner: pending invitation path
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '7 days';
  v_inviter := auth.uid();

  update public.trip_invitations
  set
    role = v_role,
    token_hash = v_token_hash,
    expires_at = v_expires_at,
    invited_by = v_inviter,
    updated_at = now()
  where trip_id = p_trip_id and email_normalized = v_email_norm and status = 'pending'
  returning id into v_inv_id;

  if v_inv_id is null then
    insert into public.trip_invitations (
      trip_id, email, email_normalized, role, status, token_hash, invited_by, expires_at
    )
    values (
      p_trip_id, p_email, v_email_norm, v_role, 'pending', v_token_hash, v_inviter, v_expires_at
    )
    returning id into v_inv_id;
  end if;

  raise log 'share_trip_with_invitation: invitation_created trip_id=% email_norm=% invitation_id=% token_issued=%',
    p_trip_id, v_email_norm, v_inv_id, true;

  return jsonb_build_object(
    'ok', true,
    'outcome', 'invitation_created',
    'invitation_id', v_inv_id,
    'invitation_token', v_token,
    'email_send_required', true
  );
end;
$$;

comment on function public.share_trip_with_invitation(uuid, text, text) is
  'Share trip by email: upsert trip_members if user exists (NULL-safe owner compare); else pending invitation.';

-- Legacy RPC (if still called): same NULL-safe member branch
create or replace function public.share_trip(p_trip_id uuid, p_email text, p_role text default 'viewer')
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
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

  select t.user_id into v_owner_id from public.trips t where t.id = p_trip_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Trip not found.');
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is not null and v_user_id is distinct from v_owner_id then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, v_user_id, v_role)
    on conflict (trip_id, user_id) do update set role = excluded.role;
    raise log 'share_trip: trip_members upsert trip_id=% member_user_id=%', p_trip_id, v_user_id;
  end if;

  return jsonb_build_object('ok', true, 'message', v_message);
end;
$$;

-- unshare_trip: avoid NULL = uuid edge (owner id unknown)
create or replace function public.unshare_trip(p_trip_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if not public.can_manage_trip_sharing(p_trip_id) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  select t.user_id into v_owner_id from public.trips t where t.id = p_trip_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Trip not found.');
  end if;

  if v_owner_id is not null and p_user_id = v_owner_id then
    return jsonb_build_object('ok', false, 'message', 'Cannot remove the trip owner.');
  end if;

  delete from public.trip_members
  where trip_id = p_trip_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;
