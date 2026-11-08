-- Packing ordering and category RPCs.
-- Additive: no existing column or function signature changes.
-- Rollback: supabase/rollbacks/20261108120000_packing_ordering_and_category_rpcs.down.sql

-- 1. Backup of current item order (service role only: RLS on, no policies).
create table if not exists public.packing_items_sort_order_backup_20261108 (
  id uuid primary key,
  sort_order integer not null
);
alter table public.packing_items_sort_order_backup_20261108 enable row level security;

insert into public.packing_items_sort_order_backup_20261108 (id, sort_order)
select id, sort_order from public.packing_items
on conflict (id) do nothing;

-- 2. One-time renumber: 0..n-1 per category, no gaps or repeats.
update public.packing_items pi
set sort_order = r.new_order
from (
  select id,
         (row_number() over (partition by category_id order by sort_order, created_at, id) - 1)::integer as new_order
  from public.packing_items
) r
where pi.id = r.id
  and pi.sort_order is distinct from r.new_order;

-- 3. Reorder items inside (and move them into) a category.
-- Ids not belonging to the trip are ignored. Duplicate ids: first occurrence wins.
-- Positions are renumbered densely after dropping ignored/duplicate ids.
create or replace function public.reorder_packing_items(
  p_trip_id uuid,
  p_category_id uuid,
  p_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not public.can_edit_trip_content(p_trip_id) then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.packing_categories c
    where c.id = p_category_id and c.trip_id = p_trip_id
  ) then
    raise exception 'category not in trip';
  end if;

  update public.packing_items pi
  set category_id = p_category_id,
      sort_order = r.new_order
  from (
    select d.id, (row_number() over (order by d.ord) - 1)::integer as new_order
    from (
      select distinct on (u.id) u.id, u.ord
      from unnest(p_ids) with ordinality as u(id, ord)
      order by u.id, u.ord
    ) d
    join public.packing_items i on i.id = d.id and i.trip_id = p_trip_id
  ) r
  where pi.id = r.id
    and pi.trip_id = p_trip_id;
end;
$$;

-- 4. Reorder categories. Same id handling as items.
create or replace function public.reorder_packing_categories(
  p_trip_id uuid,
  p_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not public.can_edit_trip_content(p_trip_id) then
    raise exception 'not allowed';
  end if;

  update public.packing_categories pc
  set sort_order = r.new_order
  from (
    select d.id, (row_number() over (order by d.ord) - 1)::integer as new_order
    from (
      select distinct on (u.id) u.id, u.ord
      from unnest(p_ids) with ordinality as u(id, ord)
      order by u.id, u.ord
    ) d
    join public.packing_categories c on c.id = d.id and c.trip_id = p_trip_id
  ) r
  where pc.id = r.id
    and pc.trip_id = p_trip_id;
end;
$$;

-- 5. Delete a category atomically: move items to p_move_to (appended) or delete them.
create or replace function public.delete_packing_category(
  p_category_id uuid,
  p_move_to uuid default null
)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_trip_id uuid;
  v_base integer;
begin
  select trip_id into v_trip_id
  from public.packing_categories
  where id = p_category_id;

  if v_trip_id is null or not public.can_edit_trip_content(v_trip_id) then
    raise exception 'not allowed';
  end if;

  if p_move_to is not null then
    if p_move_to = p_category_id then
      raise exception 'cannot move items to the category being deleted';
    end if;
    if not exists (
      select 1 from public.packing_categories c
      where c.id = p_move_to and c.trip_id = v_trip_id
    ) then
      raise exception 'target category not in trip';
    end if;

    select coalesce(max(sort_order), -1) + 1 into v_base
    from public.packing_items
    where category_id = p_move_to;

    update public.packing_items pi
    set category_id = p_move_to,
        sort_order = v_base + r.rn
    from (
      select id, (row_number() over (order by sort_order, created_at, id) - 1)::integer as rn
      from public.packing_items
      where category_id = p_category_id
    ) r
    where pi.id = r.id;
  else
    delete from public.packing_items where category_id = p_category_id;
  end if;

  delete from public.packing_categories where id = p_category_id;
end;
$$;

revoke all on function public.reorder_packing_items(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.reorder_packing_categories(uuid, uuid[]) from public, anon;
revoke all on function public.delete_packing_category(uuid, uuid) from public, anon;
grant execute on function public.reorder_packing_items(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.reorder_packing_categories(uuid, uuid[]) to authenticated;
grant execute on function public.delete_packing_category(uuid, uuid) to authenticated;

-- 6. Default categories now seeded with icons (otherwise identical body).
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
    (p_trip_id, 'Clothing', 'shirt', 0),
    (p_trip_id, 'Toiletries', 'sparkles', 1),
    (p_trip_id, 'Documents', 'ticket', 2),
    (p_trip_id, 'Electronics', 'camera', 3);
end;
$$;
