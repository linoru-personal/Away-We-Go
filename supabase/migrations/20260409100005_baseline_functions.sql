-- Business logic and RLS helper functions (dependency order).

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_editable_image_assets_updated_at()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trip permission helpers (SECURITY DEFINER; row_security off avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.has_trip_access(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid()
     );
$$;

create or replace function public.can_edit_trip_content(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role in ('admin', 'editor')
     );
$$;

create or replace function public.can_edit_trip_metadata(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

create or replace function public.can_manage_trip_sharing(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

-- ---------------------------------------------------------------------------
-- Username availability (must see other profiles; not in original dump)
-- ---------------------------------------------------------------------------
create or replace function public.check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select not exists (
    select 1 from public.profiles
    where username is not null
      and lower(username) = lower(trim(nullif(p_username, '')))
  );
$$;

-- ---------------------------------------------------------------------------
-- Packing integrity trigger function
-- ---------------------------------------------------------------------------
create or replace function public.packing_items_trip_integrity()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_cat_trip_id uuid;
  v_ok boolean;
  v_part_trip_id uuid;
begin
  select trip_id into v_cat_trip_id from public.packing_categories where id = new.category_id;
  if v_cat_trip_id is null or v_cat_trip_id != new.trip_id then
    raise exception 'packing_items category must belong to the same trip';
  end if;

  if new.assigned_to_participant_id is not null then
    select trip_id into v_part_trip_id from public.trip_participants where id = new.assigned_to_participant_id;
    if v_part_trip_id is null or v_part_trip_id != new.trip_id then
      raise exception 'assigned_to_participant_id must be a participant of this trip';
    end if;
  end if;

  if new.assigned_to_user_id is not null then
    select (
      exists (select 1 from public.trips t where t.id = new.trip_id and t.user_id = new.assigned_to_user_id)
      or exists (
        select 1 from public.trip_members m
        where m.trip_id = new.trip_id and m.user_id = new.assigned_to_user_id
      )
    ) into v_ok;
    if not v_ok then
      raise exception 'assigned_to_user_id must be trip owner or a trip member';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth: new user profile (idempotent; trigger wiring in later migration)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'username'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trip members listing for sharing UI
-- ---------------------------------------------------------------------------
create or replace function public.get_trip_members(p_trip_id uuid)
returns table (user_id uuid, email text, role text)
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select m.user_id, u.email::text, m.role::text
  from public.trip_members m
  join auth.users u on u.id = m.user_id
  where m.trip_id = p_trip_id
    and public.can_manage_trip_sharing(p_trip_id);
$$;

-- ---------------------------------------------------------------------------
-- Default packing categories
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_packing_categories(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not public.has_trip_access(p_trip_id) then
    return;
  end if;
  if not public.can_edit_trip_content(p_trip_id) then
    return;
  end if;
  if exists (select 1 from public.packing_categories where trip_id = p_trip_id limit 1) then
    return;
  end if;

  insert into public.packing_categories (trip_id, name, icon, sort_order)
  values
    (p_trip_id, 'Clothing', null, 0),
    (p_trip_id, 'Toiletries', null, 1),
    (p_trip_id, 'Documents', null, 2),
    (p_trip_id, 'Electronics', null, 3);
end;
$$;

create or replace function public.claim_pending_trip_invitations_for_user()
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
as $$
declare
  v_uid uuid := auth.uid();
  v_email_norm text;
  v_claimed int := 0;
  v_trip_ids uuid[] := '{}';
  r record;
begin
  if v_uid is null then
    raise log 'claim_pending_trip_invitations: not_authenticated';
    return jsonb_build_object(
      'ok', false,
      'claimed', 0,
      'trip_ids', '[]'::jsonb,
      'message', 'not_authenticated'
    );
  end if;

  select lower(trim(u.email)) into v_email_norm
  from auth.users u
  where u.id = v_uid;

  if v_email_norm is null or v_email_norm = '' then
    raise log 'claim_pending_trip_invitations: uid=% no_email', v_uid;
    return jsonb_build_object(
      'ok', true,
      'claimed', 0,
      'trip_ids', '[]'::jsonb,
      'email_normalized', null,
      'message', 'no_email_on_account'
    );
  end if;

  for r in
    select i.id as inv_id, i.trip_id, i.role
    from public.trip_invitations i
    where i.email_normalized = v_email_norm
      and i.status = 'pending'
      and (i.expires_at is null or i.expires_at >= now())
    order by i.created_at
    for update of i skip locked
  loop
    insert into public.trip_members (trip_id, user_id, role)
    values (r.trip_id, v_uid, r.role)
    on conflict (trip_id, user_id) do update set role = excluded.role;

    update public.trip_invitations
    set
      status = 'accepted',
      accepted_at = coalesce(accepted_at, now()),
      accepted_by_user_id = v_uid,
      updated_at = now()
    where id = r.inv_id
      and status = 'pending';

    v_claimed := v_claimed + 1;
    v_trip_ids := array_append(v_trip_ids, r.trip_id);
  end loop;

  raise log 'claim_pending_trip_invitations: uid=% email_norm=% claimed=%',
    v_uid, v_email_norm, v_claimed;

  return jsonb_build_object(
    'ok', true,
    'claimed', v_claimed,
    'trip_ids', to_jsonb(v_trip_ids),
    'email_normalized', v_email_norm,
    'message', case when v_claimed > 0 then 'claimed' else 'none_pending' end
  );
end;
$$;

comment on function public.claim_pending_trip_invitations_for_user() is
  'For the current user, grant trip_members for all non-expired pending invitations matching their auth email; mark those rows accepted.';

-- ---------------------------------------------------------------------------
-- Accept invitation (digest via extensions schema; matches share_trip_with_invitation)
-- ---------------------------------------------------------------------------
create or replace function public.accept_trip_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
as $$
declare
  v_token_hash text;
  v_inv record;
  v_user_email_norm text;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'status', 'not_authenticated',
      'trip_id', null,
      'role', null
    );
  end if;

  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select id, trip_id, email_normalized, role, status, expires_at, accepted_by_user_id
  into v_inv
  from public.trip_invitations
  where token_hash = v_token_hash
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

  if v_inv.status = 'accepted' and v_inv.accepted_by_user_id = auth.uid() then
    return jsonb_build_object(
      'success', true,
      'status', 'already_accepted',
      'trip_id', v_inv.trip_id,
      'role', v_inv.role
    );
  end if;

  if v_inv.status = 'accepted' then
    return jsonb_build_object(
      'success', false,
      'status', 'already_accepted_other',
      'trip_id', null,
      'role', null
    );
  end if;

  if v_inv.status = 'revoked' then
    return jsonb_build_object(
      'success', false,
      'status', 'revoked',
      'trip_id', null,
      'role', null
    );
  end if;

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

  if v_inv.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_token',
      'trip_id', null,
      'role', null
    );
  end if;

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

-- ---------------------------------------------------------------------------
-- share_trip (legacy 2-arg: owner only)
-- ---------------------------------------------------------------------------
create or replace function public.share_trip(p_trip_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
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

-- ---------------------------------------------------------------------------
-- share_trip (role-aware; NULL-safe owner compare)
-- ---------------------------------------------------------------------------
create or replace function public.share_trip(p_trip_id uuid, p_email text, p_role text default 'viewer')
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
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

-- ---------------------------------------------------------------------------
-- share_trip_with_invitation
-- ---------------------------------------------------------------------------
create or replace function public.share_trip_with_invitation(
  p_trip_id uuid,
  p_email text,
  p_role text default 'viewer'
)
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
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

-- ---------------------------------------------------------------------------
-- unshare_trip
-- ---------------------------------------------------------------------------
create or replace function public.unshare_trip(p_trip_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
set row_security to off
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
