-- Add sort_order to list item tables used in grouped list views.
-- Safe for shared dev/prod: additive, defaulted column + deterministic backfill.
-- No permission/RLS changes.

-- 1) packing_items (grouped by category; categories already have sort_order)
alter table public.packing_items
  add column if not exists sort_order integer not null default 0;

update public.packing_items p
set sort_order = sub.rn - 1
from (
  select id, row_number() over (partition by trip_id order by category_id, id) as rn
  from public.packing_items
) sub
where p.id = sub.id;

create index if not exists idx_packing_items_trip_id_sort_order
  on public.packing_items(trip_id, sort_order);

-- 2) trip_budget_categories (category order in budget view)
alter table public.trip_budget_categories
  add column if not exists sort_order integer not null default 0;

update public.trip_budget_categories c
set sort_order = sub.rn - 1
from (
  select id, row_number() over (partition by trip_id order by name, id) as rn
  from public.trip_budget_categories
) sub
where c.id = sub.id;

create index if not exists idx_trip_budget_categories_trip_id_sort_order
  on public.trip_budget_categories(trip_id, sort_order);

-- 3) trip_budget_items (item order within categories)
alter table public.trip_budget_items
  add column if not exists sort_order integer not null default 0;

update public.trip_budget_items b
set sort_order = sub.rn - 1
from (
  select id, row_number() over (
    partition by trip_id
    order by category_id nulls last, created_at desc, id
  ) as rn
  from public.trip_budget_items
) sub
where b.id = sub.id;

create index if not exists idx_trip_budget_items_trip_id_sort_order
  on public.trip_budget_items(trip_id, sort_order);

-- 4) tasks (To do / Completed groups; order within group)
alter table public.tasks
  add column if not exists sort_order integer not null default 0;

update public.tasks t
set sort_order = sub.rn - 1
from (
  select id, row_number() over (
    partition by trip_id
    order by case status when 'todo' then 0 else 1 end, created_at asc, id
  ) as rn
  from public.tasks
) sub
where t.id = sub.id;

create index if not exists idx_tasks_trip_id_sort_order
  on public.tasks(trip_id, sort_order);

-- 5) trip_places (flat or grouped by category)
alter table public.trip_places
  add column if not exists sort_order integer not null default 0;

update public.trip_places pl
set sort_order = sub.rn - 1
from (
  select id, row_number() over (partition by trip_id order by created_at asc, id) as rn
  from public.trip_places
) sub
where pl.id = sub.id;

create index if not exists idx_trip_places_trip_id_sort_order
  on public.trip_places(trip_id, sort_order);

-- 6) trip_place_categories (category order for places)
alter table public.trip_place_categories
  add column if not exists sort_order integer not null default 0;

update public.trip_place_categories pc
set sort_order = sub.rn - 1
from (
  select id, row_number() over (partition by trip_id order by created_at asc, id) as rn
  from public.trip_place_categories
) sub
where pc.id = sub.id;

create index if not exists idx_trip_place_categories_trip_id_sort_order
  on public.trip_place_categories(trip_id, sort_order);

-- 7) trip_notes (notes list)
alter table public.trip_notes
  add column if not exists sort_order integer not null default 0;

update public.trip_notes n
set sort_order = sub.rn - 1
from (
  select id, row_number() over (partition by trip_id order by created_at asc, id) as rn
  from public.trip_notes
) sub
where n.id = sub.id;

create index if not exists idx_trip_notes_trip_id_sort_order
  on public.trip_notes(trip_id, sort_order);
