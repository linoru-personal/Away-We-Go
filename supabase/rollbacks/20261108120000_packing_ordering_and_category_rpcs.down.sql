-- Rollback for 20261108120000_packing_ordering_and_category_rpcs.sql
-- Leaves packing_items_sort_order_backup_20261108 in place.
-- Note: items created after the migration have no backup row and keep their sort_order.

drop function if exists public.reorder_packing_items(uuid, uuid, uuid[]);
drop function if exists public.reorder_packing_categories(uuid, uuid[]);
drop function if exists public.delete_packing_category(uuid, uuid);

-- Original body from 20260409100005_baseline_functions.sql
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

update public.packing_items pi
set sort_order = b.sort_order
from public.packing_items_sort_order_backup_20261108 b
where pi.id = b.id;
