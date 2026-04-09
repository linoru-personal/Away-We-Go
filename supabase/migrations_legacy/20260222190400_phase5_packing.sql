-- Phase 5: Packing — tables, RLS, and RPC. Packing is trip content (same model as tasks, notes, budget, etc.).
-- Viewers: read-only. Owner/admin/editor: create, update, delete.
-- Assumes: has_trip_access(uuid), can_edit_trip_content(uuid) exist.

-- ---------------------------------------------------------------------------
-- 1) Tables (if not exists — safe when tables already exist in production)
-- ---------------------------------------------------------------------------

create table if not exists public.packing_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0
);

create index if not exists idx_packing_categories_trip_id on public.packing_categories(trip_id);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.packing_categories(id) on delete cascade,
  title text not null,
  quantity integer not null default 1,
  is_packed boolean not null default false,
  assigned_to_participant_id uuid references public.trip_participants(id) on delete set null
);

create index if not exists idx_packing_items_trip_id on public.packing_items(trip_id);
create index if not exists idx_packing_items_category_id on public.packing_items(category_id);

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------

alter table public.packing_categories enable row level security;
alter table public.packing_items enable row level security;

-- packing_categories: select = has_trip_access; insert/update/delete = can_edit_trip_content
drop policy if exists "packing_categories_select" on public.packing_categories;
drop policy if exists "packing_categories_insert" on public.packing_categories;
drop policy if exists "packing_categories_update" on public.packing_categories;
drop policy if exists "packing_categories_delete" on public.packing_categories;

create policy "packing_categories_select"
  on public.packing_categories for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "packing_categories_insert"
  on public.packing_categories for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));

create policy "packing_categories_update"
  on public.packing_categories for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy "packing_categories_delete"
  on public.packing_categories for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- packing_items: select = has_trip_access; insert/update/delete = can_edit_trip_content
drop policy if exists "packing_items_select" on public.packing_items;
drop policy if exists "packing_items_insert" on public.packing_items;
drop policy if exists "packing_items_update" on public.packing_items;
drop policy if exists "packing_items_delete" on public.packing_items;

create policy "packing_items_select"
  on public.packing_items for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "packing_items_insert"
  on public.packing_items for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));

create policy "packing_items_update"
  on public.packing_items for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy "packing_items_delete"
  on public.packing_items for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- ---------------------------------------------------------------------------
-- 3) RPC: ensure_default_packing_categories(p_trip_id)
-- Only creates default categories when caller has can_edit_trip_content.
-- Viewers can call it; it no-ops so they just get an empty list until an editor adds categories.
-- Drop first so we can change return type if the live DB had a different one (packing existed before migrations).
-- ---------------------------------------------------------------------------

drop function if exists public.ensure_default_packing_categories(uuid);

create or replace function public.ensure_default_packing_categories(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.ensure_default_packing_categories(uuid) to authenticated;
