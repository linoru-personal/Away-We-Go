-- =============================================================================
-- Data migration: insert extracted rows for three trips into a CLEAN target DB
-- =============================================================================
-- Trip IDs (must match extraction):
--   695afbc5-fe5b-4960-a83c-ddd4e6f20c2e  (Slovenia April 2027)
--   eda21203-1fc9-4daf-9ca3-f0ee856e1e20  (Caravan EuroTrip)
--   ef159827-95da-46f4-8524-ea23685b4d61  (Munich April 2026)
--
-- Prerequisites:
--   - Run as a role that bypasses RLS (e.g. Supabase service_role / postgres).
--   - Do NOT create auth.users here; every user UUID you reference must already
--     exist in target auth.users.
--
-- Required auth.users.id values (paste list from your source DISTINCT query):
--   - trips.user_id (owner for each of the 3 trips)
--   - trip_members.user_id
--   - trip_invitations.invited_by
--   - trip_invitations.accepted_by_user_id (when not null)
--   - trip_places.added_by_user_id
--   - packing_items.created_by (when not null)
--   - tasks.user_id
--   - packing_categories.created_by
--
--   >>> PASTE DISTINCT USER UUIDs HERE (one per line) <<<
--
--
-- How to use this file:
--   1. Run your extraction SELECTs on the SOURCE database.
--   2. For each section below, replace the VALUES (...) placeholder row with your
--      real rows (one ( ... ) tuple per source row). Use explicit casts as shown.
--   3. Remove the trailing "WHERE false" on each INSERT so rows are inserted.
--   4. Execute the whole script in one transaction on the TARGET.
--
-- Image / storage cleanup (enforced in SQL, not only in source):
--   - trips: cover_image_url, cover_image_path, destination_image_url forced NULL
--   - trip_participants: avatar_path forced NULL
--
-- Triggers: packing_items_trip_integrity runs BEFORE INSERT on packing_items.
--   Inserts must follow dependency order below; category_id and trip_id must match;
--   assigned_to_participant_id must belong to the same trip; if assigned_to_user_id
--   is set it must be trip owner or appear in trip_members for that trip.
--
-- No DISTINCT. No new IDs. No auth inserts.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) trips
-- -----------------------------------------------------------------------------
INSERT INTO public.trips (
  id,
  user_id,
  title,
  start_date,
  end_date,
  cover_image_url,
  created_at,
  destination,
  cover_image_path,
  destination_image_url
)
SELECT
  v.id,
  v.user_id,
  v.title,
  v.start_date,
  v.end_date,
  NULL::text,
  v.created_at,
  v.destination,
  NULL::text,
  NULL::text
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__REPLACE_WITH_EXTRACTED_ROWS__'::text,
      NULL::date,
      NULL::date,
      NULL::timestamptz,
      NULL::text
    )
) AS v(
  id,
  user_id,
  title,
  start_date,
  end_date,
  created_at,
  destination
)
WHERE false;

-- -----------------------------------------------------------------------------
-- 2) trip_members
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_members (
  trip_id,
  user_id,
  created_at,
  role
)
SELECT
  v.trip_id,
  v.user_id,
  v.created_at,
  v.role
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      now(),
      'viewer'::text
    )
) AS v(trip_id, user_id, created_at, role)
WHERE false;

-- -----------------------------------------------------------------------------
-- 3) trip_participants
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_participants (
  id,
  trip_id,
  name,
  avatar_path,
  sort_order,
  created_at
)
SELECT
  v.id,
  v.trip_id,
  v.name,
  NULL::text,
  v.sort_order,
  v.created_at
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__placeholder__'::text,
      0::integer,
      now()
    )
) AS v(id, trip_id, name, sort_order, created_at)
WHERE false;

-- -----------------------------------------------------------------------------
-- 4) trip_invitations
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_invitations (
  id,
  trip_id,
  email,
  email_normalized,
  role,
  status,
  token_hash,
  invited_by,
  created_at,
  updated_at,
  expires_at,
  accepted_at,
  accepted_by_user_id,
  revoked_at
)
SELECT
  v.id,
  v.trip_id,
  v.email,
  v.email_normalized,
  v.role,
  v.status,
  v.token_hash,
  v.invited_by,
  v.created_at,
  v.updated_at,
  v.expires_at,
  v.accepted_at,
  v.accepted_by_user_id,
  v.revoked_at
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      'x@example.com'::text,
      'x@example.com'::text,
      'viewer'::text,
      'pending'::text,
      '00'::text,
      '00000000-0000-0000-0000-00000000fffd'::uuid,
      now(),
      now(),
      NULL::timestamptz,
      NULL::timestamptz,
      NULL::uuid,
      NULL::timestamptz
    )
) AS v(
  id,
  trip_id,
  email,
  email_normalized,
  role,
  status,
  token_hash,
  invited_by,
  created_at,
  updated_at,
  expires_at,
  accepted_at,
  accepted_by_user_id,
  revoked_at
)
WHERE false;

-- -----------------------------------------------------------------------------
-- 5) trip_notes
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_notes (
  id,
  trip_id,
  title,
  content,
  tags,
  created_at,
  updated_at,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.title,
  v.content,
  v.tags,
  v.created_at,
  v.updated_at,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__placeholder__'::text,
      NULL::jsonb,
      NULL::text[],
      now(),
      now(),
      0::integer
    )
) AS v(id, trip_id, title, content, tags, created_at, updated_at, sort_order)
WHERE false;

-- -----------------------------------------------------------------------------
-- 6) trip_currencies
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_currencies (
  id,
  trip_id,
  currency,
  created_at
)
SELECT
  v.id,
  v.trip_id,
  v.currency,
  v.created_at
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      'USD'::text,
      now()
    )
) AS v(id, trip_id, currency, created_at)
WHERE false;

-- -----------------------------------------------------------------------------
-- 7) trip_exchange_rates
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_exchange_rates (
  id,
  trip_id,
  from_currency,
  to_currency,
  rate,
  created_at,
  updated_at
)
SELECT
  v.id,
  v.trip_id,
  v.from_currency,
  v.to_currency,
  v.rate,
  v.created_at,
  v.updated_at
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      'EUR'::text,
      'USD'::text,
      1.0::numeric,
      now(),
      now()
    )
) AS v(id, trip_id, from_currency, to_currency, rate, created_at, updated_at)
WHERE false;

-- -----------------------------------------------------------------------------
-- 8) trip_place_categories
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_place_categories (
  id,
  trip_id,
  name,
  icon,
  created_at,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.name,
  v.icon,
  v.created_at,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__placeholder__'::text,
      NULL::text,
      now(),
      0::integer
    )
) AS v(id, trip_id, name, icon, created_at, sort_order)
WHERE false;

-- -----------------------------------------------------------------------------
-- 9) trip_budget_categories
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_budget_categories (
  id,
  trip_id,
  name,
  color,
  icon,
  created_at,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.name,
  v.color,
  v.icon,
  v.created_at,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__placeholder__'::text,
      '#000000'::text,
      'icon'::text,
      now(),
      0::integer
    )
) AS v(id, trip_id, name, color, icon, created_at, sort_order)
WHERE false;

-- -----------------------------------------------------------------------------
-- 10) packing_categories
-- -----------------------------------------------------------------------------
INSERT INTO public.packing_categories (
  id,
  trip_id,
  name,
  icon,
  sort_order,
  created_at,
  created_by
)
SELECT
  v.id,
  v.trip_id,
  v.name,
  v.icon,
  v.sort_order,
  v.created_at,
  v.created_by
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '__placeholder__'::text,
      NULL::text,
      0::integer,
      now(),
      '00000000-0000-0000-0000-00000000fffd'::uuid
    )
) AS v(id, trip_id, name, icon, sort_order, created_at, created_by)
WHERE false;

-- -----------------------------------------------------------------------------
-- 11) tasks
-- -----------------------------------------------------------------------------
INSERT INTO public.tasks (
  id,
  trip_id,
  user_id,
  title,
  status,
  assignee,
  created_at,
  description,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.user_id,
  v.title,
  v.status,
  v.assignee,
  v.created_at,
  v.description,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '00000000-0000-0000-0000-00000000fffd'::uuid,
      '__placeholder__'::text,
      'todo'::text,
      'Unassigned'::text,
      now(),
      NULL::text,
      0::integer
    )
) AS v(id, trip_id, user_id, title, status, assignee, created_at, description, sort_order)
WHERE false;

-- -----------------------------------------------------------------------------
-- 12) trip_places (after trip_place_categories)
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_places (
  id,
  trip_id,
  added_by_user_id,
  title,
  google_maps_url,
  notes,
  created_at,
  category_id,
  sort_order,
  google_place_id,
  formatted_address,
  lat,
  lng
)
SELECT
  v.id,
  v.trip_id,
  v.added_by_user_id,
  v.title,
  v.google_maps_url,
  v.notes,
  v.created_at,
  v.category_id,
  v.sort_order,
  v.google_place_id,
  v.formatted_address,
  v.lat,
  v.lng
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '00000000-0000-0000-0000-00000000fffd'::uuid,
      '__placeholder__'::text,
      'https://maps.google.com/'::text,
      NULL::text,
      now(),
      NULL::uuid,
      0::integer,
      NULL::text,
      NULL::text,
      NULL::double precision,
      NULL::double precision
    )
) AS v(
  id,
  trip_id,
  added_by_user_id,
  title,
  google_maps_url,
  notes,
  created_at,
  category_id,
  sort_order,
  google_place_id,
  formatted_address,
  lat,
  lng
)
WHERE false;

-- -----------------------------------------------------------------------------
-- 13) trip_budget_items (after trip_budget_categories)
-- -----------------------------------------------------------------------------
INSERT INTO public.trip_budget_items (
  id,
  trip_id,
  category_id,
  name,
  amount,
  currency,
  amount_base,
  base_currency,
  fx_rate,
  date,
  notes,
  created_at,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.category_id,
  v.name,
  v.amount,
  v.currency,
  v.amount_base,
  v.base_currency,
  v.fx_rate,
  v.date,
  v.notes,
  v.created_at,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      NULL::uuid,
      '__placeholder__'::text,
      0::numeric,
      'USD'::text,
      0::numeric,
      'USD'::text,
      1::numeric,
      NULL::date,
      NULL::text,
      now(),
      0::integer
    )
) AS v(
  id,
  trip_id,
  category_id,
  name,
  amount,
  currency,
  amount_base,
  base_currency,
  fx_rate,
  date,
  notes,
  created_at,
  sort_order
)
WHERE false;

-- -----------------------------------------------------------------------------
-- 14) packing_items (LAST: after packing_categories, trip_participants, trips, trip_members)
-- -----------------------------------------------------------------------------
INSERT INTO public.packing_items (
  id,
  trip_id,
  category_id,
  title,
  quantity,
  is_packed,
  assigned_to_user_id,
  notes,
  created_at,
  created_by,
  assigned_to_participant_id,
  sort_order
)
SELECT
  v.id,
  v.trip_id,
  v.category_id,
  v.title,
  v.quantity,
  v.is_packed,
  v.assigned_to_user_id,
  v.notes,
  v.created_at,
  v.created_by,
  v.assigned_to_participant_id,
  v.sort_order
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-00000000ffff'::uuid,
      '00000000-0000-0000-0000-00000000fffe'::uuid,
      '00000000-0000-0000-0000-00000000fffc'::uuid,
      '__placeholder__'::text,
      1::integer,
      false,
      NULL::uuid,
      NULL::text,
      now(),
      NULL::uuid,
      NULL::uuid,
      0::integer
    )
) AS v(
  id,
  trip_id,
  category_id,
  title,
  quantity,
  is_packed,
  assigned_to_user_id,
  notes,
  created_at,
  created_by,
  assigned_to_participant_id,
  sort_order
)
WHERE false;

COMMIT;
