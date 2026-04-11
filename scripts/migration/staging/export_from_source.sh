#!/usr/bin/env bash
# =============================================================================
# Run against SOURCE Supabase / Postgres (DATABASE_URL = source connection string).
# Writes CSV files into ./export/ for COPY into target migration_staging.*.
#
# Requires: psql with access to source DB.
# Usage:
#   mkdir -p export
#   export DATABASE_URL='postgresql://...source...'
#   bash export_from_source.sh
#
# Then upload CSVs to target and \copy into migration_staging (see STAGING_WORKFLOW.md).
# =============================================================================

set -euo pipefail
OUT="${EXPORT_DIR:-./export}"
mkdir -p "$OUT"

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "\\copy (
  select id, user_id, title, start_date, end_date, cover_image_url, created_at, destination, cover_image_path, destination_image_url
  from public.trips
  where id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trips.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select trip_id, user_id, created_at, role from public.trip_members
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_members.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, name, avatar_path, sort_order, created_at from public.trip_participants
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_participants.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, email, email_normalized, role, status, token_hash, invited_by, created_at, updated_at, expires_at, accepted_at, accepted_by_user_id, revoked_at
  from public.trip_invitations
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_invitations.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, title, content, tags, created_at, updated_at, sort_order from public.trip_notes
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_notes.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, currency, created_at from public.trip_currencies
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_currencies.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, from_currency, to_currency, rate, created_at, updated_at from public.trip_exchange_rates
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_exchange_rates.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, name, icon, created_at, sort_order from public.trip_place_categories
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_place_categories.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, name, color, icon, created_at, sort_order from public.trip_budget_categories
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/trip_budget_categories.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, name, icon, sort_order, created_at, created_by from public.packing_categories
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/packing_categories.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, user_id, title, status, assignee, created_at, description, sort_order from public.tasks
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
) to '$OUT/tasks.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, added_by_user_id, title, google_maps_url, notes, created_at, category_id, sort_order, google_place_id, formatted_address, lat, lng
  from public.trip_places
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
  and (category_id is null or category_id in (
    select c.id from public.trip_place_categories c
    where c.trip_id in (
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    )
  ))
) to '$OUT/trip_places.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, category_id, name, amount, currency, amount_base, base_currency, fx_rate, date, notes, created_at, sort_order
  from public.trip_budget_items
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
  and (category_id is null or category_id in (
    select c.id from public.trip_budget_categories c
    where c.trip_id in (
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    )
  ))
) to '$OUT/trip_budget_items.csv' csv header"

"${PSQL[@]}" -c "\\copy (
  select id, trip_id, category_id, title, quantity, is_packed, assigned_to_user_id, notes, created_at, created_by, assigned_to_participant_id, sort_order
  from public.packing_items
  where trip_id in (
    '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
    'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
    'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
  )
  and category_id in (
    select pc.id from public.packing_categories pc
    where pc.trip_id in (
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    )
  )
  and (assigned_to_participant_id is null or assigned_to_participant_id in (
    select pp.id from public.trip_participants pp
    where pp.trip_id in (
      '695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid,
      'eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid,
      'ef159827-95da-46f4-8524-ea23685b4d61'::uuid
    )
  ))
) to '$OUT/packing_items.csv' csv header"

echo "Wrote CSVs to $OUT"
