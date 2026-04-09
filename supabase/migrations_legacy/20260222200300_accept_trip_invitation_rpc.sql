-- accept_trip_invitation: secure RPC to accept a trip invite by token.
-- Access is granted only via trip_members. Token matched by hash; caller email must match invitation.
-- Requires: pgcrypto (digest). Same hash as share_trip_with_invitation.

create extension if not exists pgcrypto;

create or replace function public.accept_trip_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
  v_inv record;
  v_user_email_norm text;
begin
  -- Require authenticated user
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 'not_authenticated',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Reject empty token
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Hash token the same way as when creating the invitation (sha256, hex)
  v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  -- Find invitation by token hash; lock row for update to avoid race
  select id, trip_id, email_normalized, role, status, expires_at, accepted_by_user_id
  into v_inv
  from public.trip_invitations
  where token_hash = v_token_hash
  for update;

  -- No row: invalid or already-used token
  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Already accepted by this user: idempotent success
  if v_inv.status = 'accepted' and v_inv.accepted_by_user_id = auth.uid() then
    return jsonb_build_object(
      'success', true,
      'status', 'already_accepted',
      'trip_id', v_inv.trip_id,
      'role', v_inv.role
    );
  end if;

  -- Already accepted by someone else
  if v_inv.status = 'accepted' then
    return jsonb_build_object(
      'success', false,
      'status', 'already_accepted_other',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Revoked
  if v_inv.status = 'revoked' then
    return jsonb_build_object(
      'success', false,
      'status', 'revoked',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Expired (by status or by expires_at)
  if v_inv.status = 'expired' then
    return jsonb_build_object(
      'success', false,
      'status', 'expired',
      'trip_id', null,
      'role', null
    );
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object(
      'success', false,
      'status', 'expired',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Must be pending at this point
  if v_inv.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

  -- Ensure authenticated user's email matches invitation (no accepting for another email)
  select lower(trim(email)) into v_user_email_norm
  from auth.users
  where id = auth.uid();

  if v_user_email_norm is null or v_user_email_norm <> v_inv.email_normalized then
    return jsonb_build_object(
      'success', false,
      'status', 'email_mismatch',
      'trip_id', null,
      'role', null
    );
  end if;

  -- One transaction: grant membership, mark invitation accepted
  insert into public.trip_members (trip_id, user_id, role)
  values (v_inv.trip_id, auth.uid(), v_inv.role)
  on conflict (trip_id, user_id) do update set role = excluded.role;

  update public.trip_invitations
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_by_user_id = auth.uid(),
    updated_at = now()
  where id = v_inv.id;

  return jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'trip_id', v_inv.trip_id,
    'role', v_inv.role
  );
end;
$$;

comment on function public.accept_trip_invitation(text) is
  'Accept a trip invitation by token. Caller must be authenticated; email must match invitation. Idempotent if already accepted by same user.';

grant execute on function public.accept_trip_invitation(text) to authenticated;
