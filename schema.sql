


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_trip_invitation"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."accept_trip_invitation"("p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_trip_invitation"("p_token" "text") IS 'Accept a trip invitation by token. Caller must be authenticated; email must match invitation. Idempotent if already accepted by same user.';



CREATE OR REPLACE FUNCTION "public"."can_edit_trip_content"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role in ('admin', 'editor')
     );
$$;


ALTER FUNCTION "public"."can_edit_trip_content"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_trip_metadata"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;


ALTER FUNCTION "public"."can_edit_trip_metadata"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_trip_sharing"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;


ALTER FUNCTION "public"."can_manage_trip_sharing"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_username_available"("p_username" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select not exists (
    select 1 from public.profiles
    where username is not null and lower(username) = lower(trim(nullif(p_username, '')))
  );
$$;


ALTER FUNCTION "public"."check_username_available"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_pending_trip_invitations_for_user"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
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


ALTER FUNCTION "public"."claim_pending_trip_invitations_for_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_pending_trip_invitations_for_user"() IS 'For the current user, grant trip_members for all non-expired pending invitations matching their auth email; mark those rows accepted.';



CREATE OR REPLACE FUNCTION "public"."ensure_default_packing_categories"("p_trip_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Must have trip access to avoid leaking trip existence
  if not public.has_trip_access(p_trip_id) then
    return;
  end if;
  -- Only owner/admin/editor may create categories; viewer gets no-op
  if not public.can_edit_trip_content(p_trip_id) then
    return;
  end if;
  -- Insert defaults only when the trip has no categories
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


ALTER FUNCTION "public"."ensure_default_packing_categories"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trip_members"("p_trip_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text", "role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select m.user_id, u.email::text, m.role::text
  from public.trip_members m
  join auth.users u on u.id = m.user_id
  where m.trip_id = p_trip_id
    and public.can_manage_trip_sharing(p_trip_id);
$$;


ALTER FUNCTION "public"."get_trip_members"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'username'), ''));
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_trip_access"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid()
     );
$$;


ALTER FUNCTION "public"."has_trip_access"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packing_items_trip_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cat_trip_id uuid;
  v_ok boolean;
  v_part_trip_id uuid;
begin
  -- category must belong to same trip
  select trip_id into v_cat_trip_id from public.packing_categories where id = new.category_id;
  if v_cat_trip_id is null or v_cat_trip_id != new.trip_id then
    raise exception 'packing_items category must belong to the same trip';
  end if;

  -- if assigned_to_participant_id set, must be a participant of this trip
  if new.assigned_to_participant_id is not null then
    select trip_id into v_part_trip_id from public.trip_participants where id = new.assigned_to_participant_id;
    if v_part_trip_id is null or v_part_trip_id != new.trip_id then
      raise exception 'assigned_to_participant_id must be a participant of this trip';
    end if;
  end if;

  -- if assigned_to_user_id set (legacy), must be trip owner or trip_members for this trip
  if new.assigned_to_user_id is not null then
    select (
      exists (select 1 from public.trips t where t.id = new.trip_id and t.user_id = new.assigned_to_user_id)
      or exists (select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.assigned_to_user_id)
    ) into v_ok;
    if not v_ok then
      raise exception 'assigned_to_user_id must be trip owner or a trip member';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."packing_items_trip_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_editable_image_assets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_editable_image_assets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text", "p_role" "text" DEFAULT 'viewer'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
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


ALTER FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text" DEFAULT 'viewer'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
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


ALTER FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") IS 'Share trip by email: upsert trip_members if user exists (NULL-safe owner compare); else pending invitation.';



CREATE OR REPLACE FUNCTION "public"."unshare_trip"("p_trip_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
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


ALTER FUNCTION "public"."unshare_trip"("p_trip_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."editable_image_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "original_path" "text" NOT NULL,
    "cropped_path" "text" NOT NULL,
    "crop_metadata" "jsonb",
    "aspect_preset" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_participant_avatar_has_participant" CHECK (((("owner_type" = 'participant_avatar'::"text") AND ("participant_id" IS NOT NULL)) OR (("owner_type" = ANY (ARRAY['trip_cover'::"text", 'destination_cover'::"text"])) AND ("participant_id" IS NULL)))),
    CONSTRAINT "editable_image_assets_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['trip_cover'::"text", 'destination_cover'::"text", 'participant_avatar'::"text"])))
);


ALTER TABLE "public"."editable_image_assets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."editable_image_assets"."owner_type" IS 'Image type: trip_cover | destination_cover | participant_avatar';



COMMENT ON COLUMN "public"."editable_image_assets"."original_path" IS 'Storage path to the original uploaded file (for re-crop from any device)';



COMMENT ON COLUMN "public"."editable_image_assets"."cropped_path" IS 'Storage path to the cropped derivative used by the UI';



COMMENT ON COLUMN "public"."editable_image_assets"."crop_metadata" IS 'Crop rect and zoom, e.g. { "x": 0, "y": 0, "width": 800, "height": 300, "zoom": 1 }';



COMMENT ON COLUMN "public"."editable_image_assets"."aspect_preset" IS 'Aspect preset key, e.g. hero_16_6, avatar_1_1';



CREATE TABLE IF NOT EXISTS "public"."packing_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."packing_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packing_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "is_packed" boolean DEFAULT false NOT NULL,
    "assigned_to_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "assigned_to_participant_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "packing_items_quantity_check" CHECK (("quantity" >= 1))
);


ALTER TABLE "public"."packing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profile: username (unique). Existing users may have no row; app uses email prefix as fallback.';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "assignee" "text" DEFAULT 'Unassigned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_budget_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."trip_budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "amount_base" numeric NOT NULL,
    "base_currency" "text" NOT NULL,
    "fx_rate" numeric NOT NULL,
    "date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."trip_budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_currencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "currency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trip_currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "from_currency" "text" NOT NULL,
    "to_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "rate" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trip_exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "email_normalized" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "accepted_by_user_id" "uuid",
    "revoked_at" timestamp with time zone,
    CONSTRAINT "trip_invitations_email_normalized_check" CHECK (("email_normalized" = "lower"(TRIM(BOTH FROM "email_normalized")))),
    CONSTRAINT "trip_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"]))),
    CONSTRAINT "trip_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."trip_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_invitations" IS 'Pending and historical trip invitations by email; access is granted via trip_members on accept.';



CREATE TABLE IF NOT EXISTS "public"."trip_members" (
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    CONSTRAINT "trip_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."trip_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."trip_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_path" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "added_by_user_id" "uuid" NOT NULL,
    "image_path" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "taken_at" timestamp with time zone,
    "sort_at" timestamp with time zone GENERATED ALWAYS AS (COALESCE("taken_at", "created_at")) STORED
);


ALTER TABLE "public"."trip_photos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_photos"."taken_at" IS 'When the photo was taken (EXIF when available, else null; sort uses created_at fallback).';



CREATE TABLE IF NOT EXISTS "public"."trip_place_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."trip_place_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "added_by_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "google_maps_url" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "google_place_id" "text",
    "formatted_address" "text",
    "lat" double precision,
    "lng" double precision
);


ALTER TABLE "public"."trip_places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "cover_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "destination" "text",
    "cover_image_path" "text",
    "destination_image_url" "text"
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


ALTER TABLE ONLY "public"."editable_image_assets"
    ADD CONSTRAINT "editable_image_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_categories"
    ADD CONSTRAINT "packing_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_items"
    ADD CONSTRAINT "packing_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_budget_categories"
    ADD CONSTRAINT "trip_budget_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_budget_categories"
    ADD CONSTRAINT "trip_budget_categories_trip_id_name_key" UNIQUE ("trip_id", "name");



ALTER TABLE ONLY "public"."trip_budget_items"
    ADD CONSTRAINT "trip_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_currencies"
    ADD CONSTRAINT "trip_currencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_currencies"
    ADD CONSTRAINT "trip_currencies_trip_id_currency_key" UNIQUE ("trip_id", "currency");



ALTER TABLE ONLY "public"."trip_exchange_rates"
    ADD CONSTRAINT "trip_exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_exchange_rates"
    ADD CONSTRAINT "trip_exchange_rates_trip_id_from_currency_to_currency_key" UNIQUE ("trip_id", "from_currency", "to_currency");



ALTER TABLE ONLY "public"."trip_invitations"
    ADD CONSTRAINT "trip_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_pkey" PRIMARY KEY ("trip_id", "user_id");



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_place_categories"
    ADD CONSTRAINT "trip_place_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_place_categories"
    ADD CONSTRAINT "trip_place_categories_trip_id_name_key" UNIQUE ("trip_id", "name");



ALTER TABLE ONLY "public"."trip_places"
    ADD CONSTRAINT "trip_places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_editable_image_assets_participant_avatar" ON "public"."editable_image_assets" USING "btree" ("participant_id") WHERE ("owner_type" = 'participant_avatar'::"text");



CREATE INDEX "idx_editable_image_assets_participant_id" ON "public"."editable_image_assets" USING "btree" ("participant_id") WHERE ("participant_id" IS NOT NULL);



CREATE INDEX "idx_editable_image_assets_trip_id" ON "public"."editable_image_assets" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "idx_editable_image_assets_trip_owner" ON "public"."editable_image_assets" USING "btree" ("trip_id", "owner_type") WHERE ("participant_id" IS NULL);



CREATE INDEX "idx_packing_categories_trip_id" ON "public"."packing_categories" USING "btree" ("trip_id");



CREATE INDEX "idx_packing_items_assigned_to_participant_id" ON "public"."packing_items" USING "btree" ("assigned_to_participant_id");



CREATE INDEX "idx_packing_items_category_id" ON "public"."packing_items" USING "btree" ("category_id");



CREATE INDEX "idx_packing_items_trip_id" ON "public"."packing_items" USING "btree" ("trip_id");



CREATE INDEX "idx_packing_items_trip_id_sort_order" ON "public"."packing_items" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_tasks_trip_id_sort_order" ON "public"."tasks" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_trip_budget_categories_trip_id" ON "public"."trip_budget_categories" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_budget_categories_trip_id_sort_order" ON "public"."trip_budget_categories" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_trip_budget_items_category_id" ON "public"."trip_budget_items" USING "btree" ("category_id");



CREATE INDEX "idx_trip_budget_items_trip_id" ON "public"."trip_budget_items" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_budget_items_trip_id_created_at" ON "public"."trip_budget_items" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "idx_trip_budget_items_trip_id_sort_order" ON "public"."trip_budget_items" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_trip_currencies_trip_id" ON "public"."trip_currencies" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_exchange_rates_trip_id" ON "public"."trip_exchange_rates" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_exchange_rates_trip_id_from" ON "public"."trip_exchange_rates" USING "btree" ("trip_id", "from_currency");



CREATE INDEX "idx_trip_invitations_email_normalized_status" ON "public"."trip_invitations" USING "btree" ("email_normalized", "status");



CREATE UNIQUE INDEX "idx_trip_invitations_trip_email_pending" ON "public"."trip_invitations" USING "btree" ("trip_id", "email_normalized") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_trip_invitations_trip_id_status" ON "public"."trip_invitations" USING "btree" ("trip_id", "status");



CREATE INDEX "idx_trip_members_trip_id" ON "public"."trip_members" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_members_user_id" ON "public"."trip_members" USING "btree" ("user_id");



CREATE INDEX "idx_trip_notes_trip_id" ON "public"."trip_notes" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_notes_trip_id_created_at" ON "public"."trip_notes" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "idx_trip_notes_trip_id_sort_order" ON "public"."trip_notes" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_trip_participants_trip_id" ON "public"."trip_participants" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "idx_trip_participants_trip_id_id" ON "public"."trip_participants" USING "btree" ("trip_id", "id");



CREATE INDEX "idx_trip_photos_trip_id" ON "public"."trip_photos" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_photos_trip_sort_at" ON "public"."trip_photos" USING "btree" ("trip_id", "sort_at");



CREATE INDEX "idx_trip_place_categories_trip_id" ON "public"."trip_place_categories" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_place_categories_trip_id_sort_order" ON "public"."trip_place_categories" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "idx_trip_places_category_id" ON "public"."trip_places" USING "btree" ("category_id");



CREATE INDEX "idx_trip_places_trip_id" ON "public"."trip_places" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_places_trip_id_created_at" ON "public"."trip_places" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "idx_trip_places_trip_id_sort_order" ON "public"."trip_places" USING "btree" ("trip_id", "sort_order");



CREATE INDEX "packing_categories_trip_id_idx" ON "public"."packing_categories" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "packing_categories_trip_name_unique" ON "public"."packing_categories" USING "btree" ("trip_id", "lower"("name"));



CREATE UNIQUE INDEX "profiles_username_lower_key" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);



CREATE OR REPLACE TRIGGER "editable_image_assets_updated_at" BEFORE UPDATE ON "public"."editable_image_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_editable_image_assets_updated_at"();



CREATE OR REPLACE TRIGGER "packing_items_trip_integrity_trigger" BEFORE INSERT OR UPDATE ON "public"."packing_items" FOR EACH ROW EXECUTE FUNCTION "public"."packing_items_trip_integrity"();



CREATE OR REPLACE TRIGGER "trip_invitations_updated_at" BEFORE UPDATE ON "public"."trip_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."editable_image_assets"
    ADD CONSTRAINT "editable_image_assets_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."trip_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."editable_image_assets"
    ADD CONSTRAINT "editable_image_assets_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."editable_image_assets"
    ADD CONSTRAINT "fk_editable_image_assets_avatar_trip" FOREIGN KEY ("trip_id", "participant_id") REFERENCES "public"."trip_participants"("trip_id", "id");



COMMENT ON CONSTRAINT "fk_editable_image_assets_avatar_trip" ON "public"."editable_image_assets" IS 'For participant_avatar: ensures the participant belongs to this trip. No effect when participant_id is null.';



ALTER TABLE ONLY "public"."packing_categories"
    ADD CONSTRAINT "packing_categories_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_items"
    ADD CONSTRAINT "packing_items_assigned_to_participant_id_fkey" FOREIGN KEY ("assigned_to_participant_id") REFERENCES "public"."trip_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packing_items"
    ADD CONSTRAINT "packing_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."packing_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."packing_items"
    ADD CONSTRAINT "packing_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packing_items"
    ADD CONSTRAINT "packing_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_budget_categories"
    ADD CONSTRAINT "trip_budget_categories_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_budget_items"
    ADD CONSTRAINT "trip_budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."trip_budget_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_budget_items"
    ADD CONSTRAINT "trip_budget_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_currencies"
    ADD CONSTRAINT "trip_currencies_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_exchange_rates"
    ADD CONSTRAINT "trip_exchange_rates_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_invitations"
    ADD CONSTRAINT "trip_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_invitations"
    ADD CONSTRAINT "trip_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trip_invitations"
    ADD CONSTRAINT "trip_invitations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_place_categories"
    ADD CONSTRAINT "trip_place_categories_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_places"
    ADD CONSTRAINT "trip_places_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_places"
    ADD CONSTRAINT "trip_places_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."trip_place_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_places"
    ADD CONSTRAINT "trip_places_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE "public"."editable_image_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "editable_image_assets_delete" ON "public"."editable_image_assets" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_metadata"("trip_id"));



CREATE POLICY "editable_image_assets_insert" ON "public"."editable_image_assets" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_metadata"("trip_id"));



CREATE POLICY "editable_image_assets_select" ON "public"."editable_image_assets" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "editable_image_assets_update" ON "public"."editable_image_assets" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_metadata"("trip_id")) WITH CHECK ("public"."can_edit_trip_metadata"("trip_id"));



ALTER TABLE "public"."packing_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_categories_delete" ON "public"."packing_categories" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "packing_categories_insert" ON "public"."packing_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "packing_categories_select" ON "public"."packing_categories" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "packing_categories_update" ON "public"."packing_categories" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."packing_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_items_delete" ON "public"."packing_items" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "packing_items_insert" ON "public"."packing_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "packing_items_select" ON "public"."packing_items" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "packing_items_update" ON "public"."packing_items" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete" ON "public"."tasks" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_budget_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_budget_categories_delete" ON "public"."trip_budget_categories" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_budget_categories_insert" ON "public"."trip_budget_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_budget_categories_select" ON "public"."trip_budget_categories" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_budget_categories_update" ON "public"."trip_budget_categories" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_budget_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_budget_items_delete" ON "public"."trip_budget_items" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_budget_items_insert" ON "public"."trip_budget_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_budget_items_select" ON "public"."trip_budget_items" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_budget_items_update" ON "public"."trip_budget_items" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_currencies_delete" ON "public"."trip_currencies" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_currencies_insert" ON "public"."trip_currencies" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_currencies_select" ON "public"."trip_currencies" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_currencies_update" ON "public"."trip_currencies" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_exchange_rates_delete" ON "public"."trip_exchange_rates" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_exchange_rates_insert" ON "public"."trip_exchange_rates" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_exchange_rates_select" ON "public"."trip_exchange_rates" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_exchange_rates_update" ON "public"."trip_exchange_rates" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_invitations_insert" ON "public"."trip_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_manage_trip_sharing"("trip_id") AND ("invited_by" = "auth"."uid"())));



CREATE POLICY "trip_invitations_select" ON "public"."trip_invitations" FOR SELECT TO "authenticated" USING ("public"."can_manage_trip_sharing"("trip_id"));



CREATE POLICY "trip_invitations_update" ON "public"."trip_invitations" FOR UPDATE TO "authenticated" USING ("public"."can_manage_trip_sharing"("trip_id")) WITH CHECK ("public"."can_manage_trip_sharing"("trip_id"));



ALTER TABLE "public"."trip_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_members_delete" ON "public"."trip_members" FOR DELETE TO "authenticated" USING ("public"."can_manage_trip_sharing"("trip_id"));



CREATE POLICY "trip_members_insert" ON "public"."trip_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_trip_sharing"("trip_id"));



CREATE POLICY "trip_members_select" ON "public"."trip_members" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_members_update" ON "public"."trip_members" FOR UPDATE TO "authenticated" USING ("public"."can_manage_trip_sharing"("trip_id")) WITH CHECK ("public"."can_manage_trip_sharing"("trip_id"));



ALTER TABLE "public"."trip_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_notes_delete" ON "public"."trip_notes" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_notes_insert" ON "public"."trip_notes" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_notes_select" ON "public"."trip_notes" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_notes_update" ON "public"."trip_notes" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_participants_delete" ON "public"."trip_participants" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_metadata"("trip_id"));



CREATE POLICY "trip_participants_insert" ON "public"."trip_participants" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_metadata"("trip_id"));



CREATE POLICY "trip_participants_select" ON "public"."trip_participants" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_participants_update" ON "public"."trip_participants" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_metadata"("trip_id")) WITH CHECK ("public"."can_edit_trip_metadata"("trip_id"));



ALTER TABLE "public"."trip_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_photos_delete" ON "public"."trip_photos" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_photos_insert" ON "public"."trip_photos" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_photos_select" ON "public"."trip_photos" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_photos_update" ON "public"."trip_photos" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_place_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_place_categories_delete" ON "public"."trip_place_categories" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_place_categories_insert" ON "public"."trip_place_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_place_categories_select" ON "public"."trip_place_categories" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_place_categories_update" ON "public"."trip_place_categories" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trip_places" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_places_delete" ON "public"."trip_places" FOR DELETE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_places_insert" ON "public"."trip_places" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



CREATE POLICY "trip_places_select" ON "public"."trip_places" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("trip_id"));



CREATE POLICY "trip_places_update" ON "public"."trip_places" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_content"("trip_id")) WITH CHECK ("public"."can_edit_trip_content"("trip_id"));



ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trips_delete" ON "public"."trips" FOR DELETE TO "authenticated" USING ("public"."is_trip_owner"("id"));



CREATE POLICY "trips_insert" ON "public"."trips" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "trips_select" ON "public"."trips" FOR SELECT TO "authenticated" USING ("public"."has_trip_access"("id"));



CREATE POLICY "trips_update" ON "public"."trips" FOR UPDATE TO "authenticated" USING ("public"."can_edit_trip_metadata"("id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_trip_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_trip_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_trip_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_trip_content"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_trip_content"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_trip_content"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_trip_metadata"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_trip_metadata"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_trip_metadata"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_trip_sharing"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_trip_sharing"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_trip_sharing"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_username_available"("p_username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_username_available"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_username_available"("p_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_pending_trip_invitations_for_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_pending_trip_invitations_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_pending_trip_invitations_for_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_default_packing_categories"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_default_packing_categories"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_default_packing_categories"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trip_members"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_trip_members"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trip_members"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_trip_access"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_trip_access"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_trip_access"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."packing_items_trip_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."packing_items_trip_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."packing_items_trip_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_editable_image_assets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_editable_image_assets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_editable_image_assets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_trip"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_trip_with_invitation"("p_trip_id" "uuid", "p_email" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unshare_trip"("p_trip_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unshare_trip"("p_trip_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unshare_trip"("p_trip_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."editable_image_assets" TO "anon";
GRANT ALL ON TABLE "public"."editable_image_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."editable_image_assets" TO "service_role";



GRANT ALL ON TABLE "public"."packing_categories" TO "anon";
GRANT ALL ON TABLE "public"."packing_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_categories" TO "service_role";



GRANT ALL ON TABLE "public"."packing_items" TO "anon";
GRANT ALL ON TABLE "public"."packing_items" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_items" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."trip_budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."trip_budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_budget_categories" TO "service_role";



GRANT ALL ON TABLE "public"."trip_budget_items" TO "anon";
GRANT ALL ON TABLE "public"."trip_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."trip_currencies" TO "anon";
GRANT ALL ON TABLE "public"."trip_currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_currencies" TO "service_role";



GRANT ALL ON TABLE "public"."trip_exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."trip_exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."trip_invitations" TO "anon";
GRANT ALL ON TABLE "public"."trip_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."trip_members" TO "anon";
GRANT ALL ON TABLE "public"."trip_members" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_members" TO "service_role";



GRANT ALL ON TABLE "public"."trip_notes" TO "anon";
GRANT ALL ON TABLE "public"."trip_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_notes" TO "service_role";



GRANT ALL ON TABLE "public"."trip_participants" TO "anon";
GRANT ALL ON TABLE "public"."trip_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_participants" TO "service_role";



GRANT ALL ON TABLE "public"."trip_photos" TO "anon";
GRANT ALL ON TABLE "public"."trip_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_photos" TO "service_role";



GRANT ALL ON TABLE "public"."trip_place_categories" TO "anon";
GRANT ALL ON TABLE "public"."trip_place_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_place_categories" TO "service_role";



GRANT ALL ON TABLE "public"."trip_places" TO "anon";
GRANT ALL ON TABLE "public"."trip_places" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_places" TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "anon";
GRANT ALL ON TABLE "public"."trips" TO "authenticated";
GRANT ALL ON TABLE "public"."trips" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







