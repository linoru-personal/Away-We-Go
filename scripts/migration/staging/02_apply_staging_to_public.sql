-- =============================================================================
-- Target DB: promote migration_staging -> public (verified dependency order)
-- =============================================================================
-- Preconditions:
--   - public tables are EMPTY for these trip ids (clean target).
--   - migration_staging is loaded (COPY) with extracted rows only.
--   - All referenced auth.users rows already exist on target.
-- Run as service_role / postgres (bypasses RLS).
--
-- Trip scope (only these ids are copied from staging -> public):
--   695afbc5-fe5b-4960-a83c-ddd4e6f20c2e
--   eda21203-1fc9-4daf-9ca3-f0ee856e1e20
--   ef159827-95da-46f4-8524-ea23685b4d61
--
-- Cleanup: null trip image columns; null trip_participants.avatar_path
-- =============================================================================

begin;

create temporary table _migration_allowed_trips (trip_id uuid primary key) on commit drop;

insert into _migration_allowed_trips (trip_id) values
  ('695afbc5-fe5b-4960-a83c-ddd4e6f20c2e'::uuid),
  ('eda21203-1fc9-4daf-9ca3-f0ee856e1e20'::uuid),
  ('ef159827-95da-46f4-8524-ea23685b4d61'::uuid);

-- 1 trips
insert into public.trips (
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
select
  s.id,
  s.user_id,
  s.title,
  s.start_date,
  s.end_date,
  null::text,
  s.created_at,
  s.destination,
  null::text,
  null::text
from migration_staging.trips s
where s.id in (select trip_id from _migration_allowed_trips);

-- 2 trip_members
insert into public.trip_members (trip_id, user_id, created_at, role)
select m.trip_id, m.user_id, m.created_at, m.role
from migration_staging.trip_members m
where m.trip_id in (select trip_id from _migration_allowed_trips);

-- 3 trip_participants
insert into public.trip_participants (id, trip_id, name, avatar_path, sort_order, created_at)
select p.id, p.trip_id, p.name, null::text, p.sort_order, p.created_at
from migration_staging.trip_participants p
where p.trip_id in (select trip_id from _migration_allowed_trips);

-- 4 trip_invitations
insert into public.trip_invitations (
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
select
  i.id,
  i.trip_id,
  i.email,
  i.email_normalized,
  i.role,
  i.status,
  i.token_hash,
  i.invited_by,
  i.created_at,
  i.updated_at,
  i.expires_at,
  i.accepted_at,
  i.accepted_by_user_id,
  i.revoked_at
from migration_staging.trip_invitations i
where i.trip_id in (select trip_id from _migration_allowed_trips);

-- 5 trip_notes
insert into public.trip_notes (
  id,
  trip_id,
  title,
  content,
  tags,
  created_at,
  updated_at,
  sort_order
)
select n.id, n.trip_id, n.title, n.content, n.tags, n.created_at, n.updated_at, n.sort_order
from migration_staging.trip_notes n
where n.trip_id in (select trip_id from _migration_allowed_trips);

-- 6 trip_currencies
insert into public.trip_currencies (id, trip_id, currency, created_at)
select c.id, c.trip_id, c.currency, c.created_at
from migration_staging.trip_currencies c
where c.trip_id in (select trip_id from _migration_allowed_trips);

-- 7 trip_exchange_rates
insert into public.trip_exchange_rates (
  id,
  trip_id,
  from_currency,
  to_currency,
  rate,
  created_at,
  updated_at
)
select e.id, e.trip_id, e.from_currency, e.to_currency, e.rate, e.created_at, e.updated_at
from migration_staging.trip_exchange_rates e
where e.trip_id in (select trip_id from _migration_allowed_trips);

-- 8 trip_place_categories
insert into public.trip_place_categories (id, trip_id, name, icon, created_at, sort_order)
select c.id, c.trip_id, c.name, c.icon, c.created_at, c.sort_order
from migration_staging.trip_place_categories c
where c.trip_id in (select trip_id from _migration_allowed_trips);

-- 9 trip_budget_categories
insert into public.trip_budget_categories (
  id,
  trip_id,
  name,
  color,
  icon,
  created_at,
  sort_order
)
select b.id, b.trip_id, b.name, b.color, b.icon, b.created_at, b.sort_order
from migration_staging.trip_budget_categories b
where b.trip_id in (select trip_id from _migration_allowed_trips);

-- 10 packing_categories
insert into public.packing_categories (
  id,
  trip_id,
  name,
  icon,
  sort_order,
  created_at,
  created_by
)
select k.id, k.trip_id, k.name, k.icon, k.sort_order, k.created_at, k.created_by
from migration_staging.packing_categories k
where k.trip_id in (select trip_id from _migration_allowed_trips);

-- 11 tasks
insert into public.tasks (
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
select t.id, t.trip_id, t.user_id, t.title, t.status, t.assignee, t.created_at, t.description, t.sort_order
from migration_staging.tasks t
where t.trip_id in (select trip_id from _migration_allowed_trips);

-- 12 trip_places
insert into public.trip_places (
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
select
  pl.id,
  pl.trip_id,
  pl.added_by_user_id,
  pl.title,
  pl.google_maps_url,
  pl.notes,
  pl.created_at,
  pl.category_id,
  pl.sort_order,
  pl.google_place_id,
  pl.formatted_address,
  pl.lat,
  pl.lng
from migration_staging.trip_places pl
where pl.trip_id in (select trip_id from _migration_allowed_trips);

-- 13 trip_budget_items
insert into public.trip_budget_items (
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
select
  bi.id,
  bi.trip_id,
  bi.category_id,
  bi.name,
  bi.amount,
  bi.currency,
  bi.amount_base,
  bi.base_currency,
  bi.fx_rate,
  bi.date,
  bi.notes,
  bi.created_at,
  bi.sort_order
from migration_staging.trip_budget_items bi
where bi.trip_id in (select trip_id from _migration_allowed_trips);

-- 14 packing_items (trigger packing_items_trip_integrity applies here)
insert into public.packing_items (
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
select
  pi.id,
  pi.trip_id,
  pi.category_id,
  pi.title,
  pi.quantity,
  pi.is_packed,
  pi.assigned_to_user_id,
  pi.notes,
  pi.created_at,
  pi.created_by,
  pi.assigned_to_participant_id,
  pi.sort_order
from migration_staging.packing_items pi
where pi.trip_id in (select trip_id from _migration_allowed_trips);

commit;
