-- =============================================================================
-- DRY RUN: row counts + orphan + missing auth.users checks
-- =============================================================================
-- Run against the SOURCE database (or any DB that still holds the rows to
-- migrate). Does NOT insert. Read-only counts and integrity probes.
--
-- Trip scope (same as migration / extraction):
--   695afbc5-fe5b-4960-a83c-ddd4e6f20c2e
--   eda21203-1fc9-4daf-9ca3-f0ee856e1e20
--   ef159827-95da-46f4-8524-ea23685b4d61
--
-- Interpretation:
--   - section row_count = rows that WOULD be inserted for that table (same
--     filters as the extraction queries).
--   - orphan_* counts should be 0 before migrating.
--   - missing_auth_users_on_source should be 0 on source (always true); run
--     the same missing-user query on TARGET after provisioning users.
-- =============================================================================

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
),

-- ---------------------------------------------------------------------------
-- Row counts (one per table; mirrors extraction WHERE logic)
-- ---------------------------------------------------------------------------
counts AS (
  SELECT
    '1_trips'::text AS section,
    (
      SELECT COUNT(*)::bigint
      FROM public.trips AS t
      WHERE t.id IN (SELECT tid FROM allowed)
    ) AS row_count
  UNION ALL
  SELECT
    '2_trip_members',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_members AS tm
      WHERE tm.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '3_trip_participants',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_participants AS pp
      WHERE pp.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '4_trip_invitations',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_invitations AS ti
      WHERE ti.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '5_trip_notes',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_notes AS n
      WHERE n.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '6_trip_currencies',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_currencies AS tc
      WHERE tc.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '7_trip_exchange_rates',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_exchange_rates AS er
      WHERE er.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '8_trip_place_categories',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_place_categories AS c
      WHERE c.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '9_trip_budget_categories',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_budget_categories AS bc
      WHERE bc.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '10_packing_categories',
    (
      SELECT COUNT(*)::bigint
      FROM public.packing_categories AS pc
      WHERE pc.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '11_tasks',
    (
      SELECT COUNT(*)::bigint
      FROM public.tasks AS tk
      WHERE tk.trip_id IN (SELECT tid FROM allowed)
    )
  UNION ALL
  SELECT
    '12_trip_places',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_places AS pl
      WHERE pl.trip_id IN (SELECT tid FROM allowed)
        AND (
          pl.category_id IS NULL
          OR pl.category_id IN (
            SELECT c.id
            FROM public.trip_place_categories AS c
            WHERE c.trip_id IN (SELECT tid FROM allowed)
          )
        )
    )
  UNION ALL
  SELECT
    '13_trip_budget_items',
    (
      SELECT COUNT(*)::bigint
      FROM public.trip_budget_items AS bi
      WHERE bi.trip_id IN (SELECT tid FROM allowed)
        AND (
          bi.category_id IS NULL
          OR bi.category_id IN (
            SELECT c.id
            FROM public.trip_budget_categories AS c
            WHERE c.trip_id IN (SELECT tid FROM allowed)
          )
        )
    )
  UNION ALL
  SELECT
    '14_packing_items',
    (
      SELECT COUNT(*)::bigint
      FROM public.packing_items AS pi
      WHERE pi.trip_id IN (SELECT tid FROM allowed)
        AND pi.category_id IN (
          SELECT pc.id
          FROM public.packing_categories AS pc
          WHERE pc.trip_id IN (SELECT tid FROM allowed)
        )
        AND (
          pi.assigned_to_participant_id IS NULL
          OR pi.assigned_to_participant_id IN (
            SELECT pp.id
            FROM public.trip_participants AS pp
            WHERE pp.trip_id IN (SELECT tid FROM allowed)
          )
        )
    )
)

SELECT
  section,
  row_count
FROM counts
ORDER BY section;


-- =============================================================================
-- Expectation: exactly 3 trips in scope
-- =============================================================================
WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'sanity_trips_in_scope'::text AS check_name,
  (SELECT COUNT(*)::bigint FROM public.trips t WHERE t.id IN (SELECT tid FROM allowed)) AS value,
  CASE
    WHEN (SELECT COUNT(*) FROM public.trips t WHERE t.id IN (SELECT tid FROM allowed)) = 3
    THEN 'ok'
    ELSE 'unexpected: expected 3 trip rows'
  END AS status;


-- =============================================================================
-- Orphan / integrity checks (should all be 0)
-- =============================================================================

-- trip_places: non-null category_id pointing outside allowed place categories
WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'orphan_trip_places_bad_category'::text AS check_name,
  COUNT(*)::bigint AS bad_row_count
FROM public.trip_places AS pl
WHERE pl.trip_id IN (SELECT tid FROM allowed)
  AND pl.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trip_place_categories AS c
    WHERE c.id = pl.category_id
      AND c.trip_id = pl.trip_id
  );

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'orphan_trip_budget_items_bad_category'::text AS check_name,
  COUNT(*)::bigint AS bad_row_count
FROM public.trip_budget_items AS bi
WHERE bi.trip_id IN (SELECT tid FROM allowed)
  AND bi.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trip_budget_categories AS c
    WHERE c.id = bi.category_id
      AND c.trip_id = bi.trip_id
  );

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'orphan_packing_items_bad_category'::text AS check_name,
  COUNT(*)::bigint AS bad_row_count
FROM public.packing_items AS pi
WHERE pi.trip_id IN (SELECT tid FROM allowed)
  AND NOT EXISTS (
    SELECT 1
    FROM public.packing_categories AS pc
    WHERE pc.id = pi.category_id
      AND pc.trip_id = pi.trip_id
  );

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'orphan_packing_items_bad_participant'::text AS check_name,
  COUNT(*)::bigint AS bad_row_count
FROM public.packing_items AS pi
WHERE pi.trip_id IN (SELECT tid FROM allowed)
  AND pi.assigned_to_participant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.trip_participants AS pp
    WHERE pp.id = pi.assigned_to_participant_id
      AND pp.trip_id = pi.trip_id
  );

-- Matches packing_items_trip_integrity trigger logic for assigned_to_user_id
WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'packing_items_assigned_user_not_owner_or_member'::text AS check_name,
  COUNT(*)::bigint AS bad_row_count
FROM public.packing_items AS pi
WHERE pi.trip_id IN (SELECT tid FROM allowed)
  AND pi.assigned_to_user_id IS NOT NULL
  AND NOT (
    EXISTS (
      SELECT 1
      FROM public.trips AS t
      WHERE t.id = pi.trip_id
        AND t.user_id = pi.assigned_to_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_members AS m
      WHERE m.trip_id = pi.trip_id
        AND m.user_id = pi.assigned_to_user_id
    )
  );

-- Rows that WOULD be excluded from extraction (exposed for review; not migrated)
WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'excluded_packing_items_not_in_extract'::text AS check_name,
  COUNT(*)::bigint AS row_count
FROM public.packing_items AS pi
WHERE pi.trip_id IN (SELECT tid FROM allowed)
  AND (
    pi.category_id NOT IN (
      SELECT pc.id
      FROM public.packing_categories AS pc
      WHERE pc.trip_id IN (SELECT tid FROM allowed)
    )
    OR (
      pi.assigned_to_participant_id IS NOT NULL
      AND pi.assigned_to_participant_id NOT IN (
        SELECT pp.id
        FROM public.trip_participants AS pp
        WHERE pp.trip_id IN (SELECT tid FROM allowed)
      )
    )
  );

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'excluded_trip_places_not_in_extract'::text AS check_name,
  COUNT(*)::bigint AS row_count
FROM public.trip_places AS pl
WHERE pl.trip_id IN (SELECT tid FROM allowed)
  AND pl.category_id IS NOT NULL
  AND pl.category_id NOT IN (
    SELECT c.id
    FROM public.trip_place_categories AS c
    WHERE c.trip_id IN (SELECT tid FROM allowed)
  );

WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
)
SELECT
  'excluded_trip_budget_items_not_in_extract'::text AS check_name,
  COUNT(*)::bigint AS row_count
FROM public.trip_budget_items AS bi
WHERE bi.trip_id IN (SELECT tid FROM allowed)
  AND bi.category_id IS NOT NULL
  AND bi.category_id NOT IN (
    SELECT c.id
    FROM public.trip_budget_categories AS c
    WHERE c.trip_id IN (SELECT tid FROM allowed)
  );


-- =============================================================================
-- Missing auth.users for referenced UUIDs (run on SOURCE and on TARGET)
-- =============================================================================
WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
),
ref_uids AS (
  SELECT t.user_id AS uid
  FROM public.trips AS t
  WHERE t.id IN (SELECT tid FROM allowed)
  UNION
  SELECT tm.user_id
  FROM public.trip_members AS tm
  WHERE tm.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT ti.invited_by
  FROM public.trip_invitations AS ti
  WHERE ti.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT ti.accepted_by_user_id
  FROM public.trip_invitations AS ti
  WHERE ti.trip_id IN (SELECT tid FROM allowed)
    AND ti.accepted_by_user_id IS NOT NULL
  UNION
  SELECT pl.added_by_user_id
  FROM public.trip_places AS pl
  WHERE pl.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT pi.created_by
  FROM public.packing_items AS pi
  WHERE pi.trip_id IN (SELECT tid FROM allowed)
    AND pi.created_by IS NOT NULL
  UNION
  SELECT tk.user_id
  FROM public.tasks AS tk
  WHERE tk.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT pc.created_by
  FROM public.packing_categories AS pc
  WHERE pc.trip_id IN (SELECT tid FROM allowed)
),
distinct_uids AS (
  SELECT DISTINCT uid
  FROM ref_uids
  WHERE uid IS NOT NULL
)
SELECT
  'missing_auth_users'::text AS check_name,
  d.uid AS user_id_missing_in_auth_users
FROM distinct_uids AS d
LEFT JOIN auth.users AS u ON u.id = d.uid
WHERE u.id IS NULL
ORDER BY d.uid;


WITH
allowed AS (
  SELECT unnest(
    ARRAY[
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    ]
  ) AS tid
),
ref_uids AS (
  SELECT t.user_id AS uid
  FROM public.trips AS t
  WHERE t.id IN (SELECT tid FROM allowed)
  UNION
  SELECT tm.user_id
  FROM public.trip_members AS tm
  WHERE tm.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT ti.invited_by
  FROM public.trip_invitations AS ti
  WHERE ti.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT ti.accepted_by_user_id
  FROM public.trip_invitations AS ti
  WHERE ti.trip_id IN (SELECT tid FROM allowed)
    AND ti.accepted_by_user_id IS NOT NULL
  UNION
  SELECT pl.added_by_user_id
  FROM public.trip_places AS pl
  WHERE pl.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT pi.created_by
  FROM public.packing_items AS pi
  WHERE pi.trip_id IN (SELECT tid FROM allowed)
    AND pi.created_by IS NOT NULL
  UNION
  SELECT tk.user_id
  FROM public.tasks AS tk
  WHERE tk.trip_id IN (SELECT tid FROM allowed)
  UNION
  SELECT pc.created_by
  FROM public.packing_categories AS pc
  WHERE pc.trip_id IN (SELECT tid FROM allowed)
),
distinct_uids AS (
  SELECT DISTINCT uid
  FROM ref_uids
  WHERE uid IS NOT NULL
)
SELECT
  'missing_auth_users_count'::text AS check_name,
  COUNT(*)::bigint AS missing_count
FROM distinct_uids AS d
LEFT JOIN auth.users AS u ON u.id = d.uid
WHERE u.id IS NULL;
