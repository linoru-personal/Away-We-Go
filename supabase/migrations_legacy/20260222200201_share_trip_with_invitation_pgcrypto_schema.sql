-- Fix: qualify pgcrypto calls so they resolve when search_path = public.
-- pgcrypto is installed in the extensions schema; the function uses set search_path = public.

create or replace function public.share_trip_with_invitation(
  p_trip_id uuid,
  p_email text,
  p_role text default 'viewer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  -- Caller must be allowed to manage sharing (owner or admin)
  if not public.can_manage_trip_sharing(p_trip_id) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  -- Normalize email; reject empty
  v_email_norm := lower(trim(p_email));
  if v_email_norm = '' then
    return jsonb_build_object('ok', false, 'message', 'Email is required.');
  end if;

  -- Validate role (same as trip_members)
  v_role := coalesce(nullif(trim(lower(p_role)), ''), 'viewer');
  if v_role not in ('admin', 'editor', 'viewer') then
    return jsonb_build_object('ok', false, 'message', 'Invalid role. Use admin, editor, or viewer.');
  end if;

  select user_id into v_owner_id from public.trips where id = p_trip_id limit 1;

  -- Look up auth user by normalized email (do not leak result to caller except via outcome)
  select id into v_user_id
  from auth.users
  where lower(trim(email)) = v_email_norm
  limit 1;

  -- Branch 1: email belongs to an existing user (and is not the owner)
  if v_user_id is not null and v_user_id <> v_owner_id then
    -- Upsert trip_members; actual access is only from here
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, v_user_id, v_role)
    on conflict (trip_id, user_id) do update set role = excluded.role;

    -- Revoke any pending invitation for this email/trip so the slot is freed and history is clear
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

  -- Branch 2: no user with this email (or email is owner) -> create or refresh pending invitation
  -- Generate single-use token for accept link; store only hash in DB (pgcrypto lives in extensions schema)
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '7 days';
  v_inviter := auth.uid();

  -- Idempotent: update existing pending row if present (one pending per trip_id + email_normalized)
  update public.trip_invitations
  set
    role = v_role,
    token_hash = v_token_hash,
    expires_at = v_expires_at,
    invited_by = v_inviter,
    updated_at = now()
  where trip_id = p_trip_id and email_normalized = v_email_norm and status = 'pending'
  returning id into v_inv_id;

  -- If no pending row existed, insert new one
  if v_inv_id is null then
    insert into public.trip_invitations (
      trip_id, email, email_normalized, role, status, token_hash, invited_by, expires_at
    )
    values (
      p_trip_id, p_email, v_email_norm, v_role, 'pending', v_token_hash, v_inviter, v_expires_at
    )
    returning id into v_inv_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'outcome', 'invitation_created',
    'invitation_id', v_inv_id,
    'invitation_token', v_token,
    'email_send_required', true
  );
end;
$$;
