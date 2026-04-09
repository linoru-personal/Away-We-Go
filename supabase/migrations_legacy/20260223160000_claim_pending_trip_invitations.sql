-- Auto-claim pending trip invitations when a user signs up or signs in.
-- Matches auth.users email (lower(trim)) to trip_invitations.email_normalized for status = pending.
-- Upserts trip_members and marks invitations accepted. Idempotent and safe under concurrency (SKIP LOCKED).

create or replace function public.claim_pending_trip_invitations_for_user()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
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

grant execute on function public.claim_pending_trip_invitations_for_user() to authenticated;
