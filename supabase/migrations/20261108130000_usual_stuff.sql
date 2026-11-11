-- Usual stuff: per-user reusable packing items, plus RPCs to reorder, add to a trip and seed categories.
-- Additive: new tables and functions only. packing_templates / packing_template_items are untouched.
-- Rollback: supabase/rollbacks/20261108130000_usual_stuff.down.sql

-- 1. Tables.
create table if not exists public.usual_lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.usual_categories (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.usual_lists (id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_usual_categories_list_name
  on public.usual_categories (list_id, lower(btrim(name)));

create table if not exists public.usual_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.usual_lists (id) on delete cascade,
  category_id uuid not null references public.usual_categories (id) on delete no action,
  title text not null check (char_length(btrim(title)) > 0),
  quantity integer not null default 1 check (quantity >= 1),
  person_label text,
  is_always boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_usual_items_identity
  on public.usual_items (category_id, lower(btrim(title)), lower(btrim(coalesce(person_label, ''))));

create index if not exists idx_usual_items_list_id on public.usual_items (list_id);

-- 2. RLS helper: usual list owned by current user (same shape as packing_template_owned_by_user).
create or replace function public.usual_list_owned_by_user(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select exists (
    select 1
    from public.usual_lists l
    where l.id = p_list_id
      and l.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.usual_list_owned_by_user(uuid) from public, anon;
grant execute on function public.usual_list_owned_by_user(uuid) to authenticated, service_role;

-- 3. RLS: owner only.
alter table public.usual_lists enable row level security;
alter table public.usual_categories enable row level security;
alter table public.usual_items enable row level security;

create policy usual_lists_select_own on public.usual_lists
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy usual_lists_insert_own on public.usual_lists
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy usual_lists_update_own on public.usual_lists
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy usual_lists_delete_own on public.usual_lists
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy usual_categories_select_own on public.usual_categories
  for select to authenticated
  using (public.usual_list_owned_by_user(list_id));

create policy usual_categories_insert_own on public.usual_categories
  for insert to authenticated
  with check (public.usual_list_owned_by_user(list_id));

create policy usual_categories_update_own on public.usual_categories
  for update to authenticated
  using (public.usual_list_owned_by_user(list_id))
  with check (public.usual_list_owned_by_user(list_id));

create policy usual_categories_delete_own on public.usual_categories
  for delete to authenticated
  using (public.usual_list_owned_by_user(list_id));

-- Items: the category must also belong to the same (owned) list.
create policy usual_items_select_own on public.usual_items
  for select to authenticated
  using (public.usual_list_owned_by_user(list_id));

create policy usual_items_insert_own on public.usual_items
  for insert to authenticated
  with check (
    public.usual_list_owned_by_user(list_id)
    and exists (
      select 1 from public.usual_categories c
      where c.id = usual_items.category_id and c.list_id = usual_items.list_id
    )
  );

create policy usual_items_update_own on public.usual_items
  for update to authenticated
  using (public.usual_list_owned_by_user(list_id))
  with check (
    public.usual_list_owned_by_user(list_id)
    and exists (
      select 1 from public.usual_categories c
      where c.id = usual_items.category_id and c.list_id = usual_items.list_id
    )
  );

create policy usual_items_delete_own on public.usual_items
  for delete to authenticated
  using (public.usual_list_owned_by_user(list_id));

grant all on table public.usual_lists to authenticated, service_role;
grant all on table public.usual_categories to authenticated, service_role;
grant all on table public.usual_items to authenticated, service_role;

-- 4. get_or_create_my_usual_list: the caller's list id, created on first call.
create or replace function public.get_or_create_my_usual_list()
returns uuid
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_list uuid;
begin
  if v_uid is null then
    raise exception 'not allowed';
  end if;

  select id into v_list from public.usual_lists where owner_user_id = v_uid;
  if v_list is null then
    insert into public.usual_lists (owner_user_id)
    values (v_uid)
    on conflict (owner_user_id) do nothing;
    select id into v_list from public.usual_lists where owner_user_id = v_uid;
  end if;

  return v_list;
end;
$$;

-- 5. reorder_usual_items: order inside (and move into) a category of the caller's list.
-- Ids not in the caller's list are ignored. Duplicate ids: first occurrence wins.
-- Moving an item into a category that already holds the same identity raises a unique violation.
create or replace function public.reorder_usual_items(
  p_category_id uuid,
  p_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_list uuid;
begin
  select id into v_list from public.usual_lists where owner_user_id = auth.uid();
  if v_list is null then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.usual_categories c
    where c.id = p_category_id and c.list_id = v_list
  ) then
    raise exception 'not allowed';
  end if;

  update public.usual_items ui
  set category_id = p_category_id,
      sort_order = r.new_order
  from (
    select d.id, (row_number() over (order by d.ord) - 1)::integer as new_order
    from (
      select distinct on (u.id) u.id, u.ord
      from unnest(p_ids) with ordinality as u(id, ord)
      order by u.id, u.ord
    ) d
    join public.usual_items i on i.id = d.id and i.list_id = v_list
  ) r
  where ui.id = r.id
    and ui.list_id = v_list;
end;
$$;

-- 6. reorder_usual_categories.
create or replace function public.reorder_usual_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_list uuid;
begin
  select id into v_list from public.usual_lists where owner_user_id = auth.uid();
  if v_list is null then
    raise exception 'not allowed';
  end if;

  update public.usual_categories uc
  set sort_order = r.new_order
  from (
    select d.id, (row_number() over (order by d.ord) - 1)::integer as new_order
    from (
      select distinct on (u.id) u.id, u.ord
      from unnest(p_ids) with ordinality as u(id, ord)
      order by u.id, u.ord
    ) d
    join public.usual_categories c on c.id = d.id and c.list_id = v_list
  ) r
  where uc.id = r.id
    and uc.list_id = v_list;
end;
$$;

-- 7. delete_usual_category: move items to p_move_to (appended) or delete them, then delete the category.
-- When moving, an item that already exists in the target (same identity) is dropped instead of moved.
create or replace function public.delete_usual_category(
  p_category_id uuid,
  p_move_to uuid default null
)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_list uuid;
  v_cat_list uuid;
  v_base integer;
begin
  select id into v_list from public.usual_lists where owner_user_id = auth.uid();
  select list_id into v_cat_list from public.usual_categories where id = p_category_id;

  if v_list is null or v_cat_list is null or v_cat_list <> v_list then
    raise exception 'not allowed';
  end if;

  if p_move_to is not null then
    if p_move_to = p_category_id then
      raise exception 'cannot move items to the category being deleted';
    end if;
    if not exists (
      select 1 from public.usual_categories c
      where c.id = p_move_to and c.list_id = v_list
    ) then
      raise exception 'target category not in list';
    end if;

    delete from public.usual_items s
    where s.category_id = p_category_id
      and exists (
        select 1 from public.usual_items t
        where t.category_id = p_move_to
          and lower(btrim(t.title)) = lower(btrim(s.title))
          and lower(btrim(coalesce(t.person_label, ''))) = lower(btrim(coalesce(s.person_label, '')))
      );

    select coalesce(max(sort_order), -1) + 1 into v_base
    from public.usual_items
    where category_id = p_move_to;

    update public.usual_items ui
    set category_id = p_move_to,
        sort_order = v_base + r.rn
    from (
      select id, (row_number() over (order by sort_order, created_at, id) - 1)::integer as rn
      from public.usual_items
      where category_id = p_category_id
    ) r
    where ui.id = r.id;
  else
    delete from public.usual_items where category_id = p_category_id;
  end if;

  delete from public.usual_categories where id = p_category_id;
end;
$$;

-- 8. add_to_my_usual_stuff: p_rows = [{title, quantity, category_name, category_icon, person_label}, ...]
-- Returns {"added": n, "skipped": [{"index": i, "usual_item_id": uuid}]}. index is the 0-based position in p_rows.
-- Rows are processed in order, so a row duplicating an earlier row in the same call is skipped too.
create or replace function public.add_to_my_usual_stuff(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_list uuid;
  v_row jsonb;
  v_ord bigint;
  v_title text;
  v_qty integer;
  v_cat_name text;
  v_cat_icon text;
  v_label text;
  v_cat_id uuid;
  v_item_id uuid;
  v_new_id uuid;
  v_added integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  v_list := public.get_or_create_my_usual_list();

  for v_row, v_ord in
    select e.value, e.ordinality
    from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_title := btrim(coalesce(v_row ->> 'title', ''));
    v_cat_name := btrim(coalesce(v_row ->> 'category_name', ''));
    if v_title = '' then
      raise exception 'title is required (row %)', v_ord - 1;
    end if;
    if v_cat_name = '' then
      raise exception 'category_name is required (row %)', v_ord - 1;
    end if;
    v_qty := greatest(coalesce((v_row ->> 'quantity')::integer, 1), 1);
    v_cat_icon := nullif(btrim(coalesce(v_row ->> 'category_icon', '')), '');
    v_label := nullif(btrim(coalesce(v_row ->> 'person_label', '')), '');
    if lower(v_label) = 'everyone' then
      v_label := null;
    end if;

    -- Find or create the category by normalized name.
    select c.id into v_cat_id
    from public.usual_categories c
    where c.list_id = v_list
      and lower(btrim(c.name)) = lower(v_cat_name);

    if v_cat_id is null then
      insert into public.usual_categories (list_id, name, icon, sort_order)
      select v_list, v_cat_name, v_cat_icon, coalesce(max(c.sort_order), -1) + 1
      from public.usual_categories c
      where c.list_id = v_list
      on conflict (list_id, (lower(btrim(name)))) do nothing
      returning id into v_cat_id;

      if v_cat_id is null then
        select c.id into v_cat_id
        from public.usual_categories c
        where c.list_id = v_list
          and lower(btrim(c.name)) = lower(v_cat_name);
      end if;
    end if;

    -- Skip when the identity already exists (existing item or earlier row of this call).
    select i.id into v_item_id
    from public.usual_items i
    where i.category_id = v_cat_id
      and lower(btrim(i.title)) = lower(v_title)
      and lower(btrim(coalesce(i.person_label, ''))) = lower(btrim(coalesce(v_label, '')))
    limit 1;

    if v_item_id is not null then
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('index', v_ord - 1, 'usual_item_id', v_item_id)
      );
      continue;
    end if;

    v_new_id := null;
    insert into public.usual_items (list_id, category_id, title, quantity, person_label, sort_order)
    select v_list, v_cat_id, v_title, v_qty, v_label, coalesce(max(i.sort_order), -1) + 1
    from public.usual_items i
    where i.category_id = v_cat_id
    on conflict (category_id, (lower(btrim(title))), (lower(btrim(coalesce(person_label, ''))))) do nothing
    returning id into v_new_id;

    if v_new_id is null then
      -- Lost a race with a concurrent insert: report it as skipped.
      select i.id into v_item_id
      from public.usual_items i
      where i.category_id = v_cat_id
        and lower(btrim(i.title)) = lower(v_title)
        and lower(btrim(coalesce(i.person_label, ''))) = lower(btrim(coalesce(v_label, '')))
      limit 1;
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object('index', v_ord - 1, 'usual_item_id', v_item_id)
      );
    else
      v_added := v_added + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end;
$$;

-- 9. add_usual_items_to_trip: p_rows = [{usual_item_id, participant_id}, ...] (participant_id null = Everyone).
-- Returns {"added": n, "skipped": n}. Re-checks "already on trip" server-side.
create or replace function public.add_usual_items_to_trip(
  p_trip_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_row jsonb;
  v_ord bigint;
  v_usual_id uuid;
  v_part_id uuid;
  v_title text;
  v_qty integer;
  v_cat_name text;
  v_cat_icon text;
  v_trip_cat uuid;
  v_added integer := 0;
  v_skipped integer := 0;
begin
  if not public.can_edit_trip_content(p_trip_id) then
    raise exception 'not allowed';
  end if;
  perform pg_advisory_xact_lock(hashtext('usual_to_trip:' || p_trip_id::text));
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  for v_row, v_ord in
    select e.value, e.ordinality
    from jsonb_array_elements(p_rows) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_usual_id := nullif(v_row ->> 'usual_item_id', '')::uuid;
    v_part_id := nullif(v_row ->> 'participant_id', '')::uuid;
    if v_usual_id is null then
      raise exception 'usual_item_id is required (row %)', v_ord - 1;
    end if;

    if v_part_id is not null and not exists (
      select 1 from public.trip_participants tp
      where tp.id = v_part_id and tp.trip_id = p_trip_id
    ) then
      raise exception 'participant not in trip (row %)', v_ord - 1;
    end if;

    -- The usual item must belong to the caller's own list.
    select ui.title, ui.quantity, uc.name, uc.icon
    into v_title, v_qty, v_cat_name, v_cat_icon
    from public.usual_items ui
    join public.usual_categories uc on uc.id = ui.category_id
    join public.usual_lists ul on ul.id = ui.list_id
    where ui.id = v_usual_id
      and ul.owner_user_id = auth.uid();

    if not found then
      raise exception 'usual item not found (row %)', v_ord - 1;
    end if;

    -- Already on the trip: same title + category name + assignee (null = Everyone).
    if exists (
      select 1
      from public.packing_items pi
      join public.packing_categories pc on pc.id = pi.category_id
      where pi.trip_id = p_trip_id
        and pc.trip_id = p_trip_id
        and lower(btrim(pc.name)) = lower(btrim(v_cat_name))
        and lower(btrim(pi.title)) = lower(btrim(v_title))
        and pi.assigned_to_participant_id is not distinct from v_part_id
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Find the trip category by normalized name, or create it at the end.
    select pc.id into v_trip_cat
    from public.packing_categories pc
    where pc.trip_id = p_trip_id
      and lower(btrim(pc.name)) = lower(btrim(v_cat_name))
    order by pc.sort_order, pc.created_at, pc.id
    limit 1;

    if v_trip_cat is null then
      insert into public.packing_categories (trip_id, name, icon, sort_order)
      select p_trip_id, btrim(v_cat_name), v_cat_icon, coalesce(max(pc.sort_order), -1) + 1
      from public.packing_categories pc
      where pc.trip_id = p_trip_id
      returning id into v_trip_cat;
    end if;

    insert into public.packing_items (
      trip_id, category_id, title, quantity, is_packed,
      assigned_to_participant_id, created_by, sort_order
    )
    select p_trip_id, v_trip_cat, btrim(v_title), v_qty, false,
           v_part_id, auth.uid(), coalesce(max(pi.sort_order), -1) + 1
    from public.packing_items pi
    where pi.category_id = v_trip_cat;

    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end;
$$;

-- 10. seed_trip_categories_from_usual: owner only; no-op if the trip already has categories.
create or replace function public.seed_trip_categories_from_usual(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_list uuid;
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.packing_categories where trip_id = p_trip_id limit 1) then
    return;
  end if;

  select id into v_list from public.usual_lists where owner_user_id = auth.uid();

  if v_list is not null
     and exists (select 1 from public.usual_categories where list_id = v_list limit 1) then
    insert into public.packing_categories (trip_id, name, icon, sort_order)
    select p_trip_id, uc.name, uc.icon, uc.sort_order
    from public.usual_categories uc
    where uc.list_id = v_list
    order by uc.sort_order, uc.created_at, uc.id;
  else
    perform public.ensure_default_packing_categories(p_trip_id);
  end if;
end;
$$;

-- 11. Grants.
revoke all on function public.get_or_create_my_usual_list() from public, anon;
revoke all on function public.reorder_usual_items(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_usual_categories(uuid[]) from public, anon;
revoke all on function public.delete_usual_category(uuid, uuid) from public, anon;
revoke all on function public.add_to_my_usual_stuff(jsonb) from public, anon;
revoke all on function public.add_usual_items_to_trip(uuid, jsonb) from public, anon;
revoke all on function public.seed_trip_categories_from_usual(uuid) from public, anon;
grant execute on function public.get_or_create_my_usual_list() to authenticated;
grant execute on function public.reorder_usual_items(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_usual_categories(uuid[]) to authenticated;
grant execute on function public.delete_usual_category(uuid, uuid) to authenticated;
grant execute on function public.add_to_my_usual_stuff(jsonb) to authenticated;
grant execute on function public.add_usual_items_to_trip(uuid, jsonb) to authenticated;
grant execute on function public.seed_trip_categories_from_usual(uuid) to authenticated;

-- SQL checks (run signed in, e.g. via set request.jwt.claims, after applying):
-- 5.1 select get_or_create_my_usual_list();  -- run twice: same uuid both times.
-- 5.2 select add_to_my_usual_stuff('[{"title":"Toothbrush","quantity":1,"category_name":"Toiletries","category_icon":"sparkles","person_label":"Noa"},{"title":"Toothbrush","quantity":1,"category_name":"Toiletries","category_icon":"sparkles","person_label":"Dan"}]');
--     -> added: 2
-- 5.3 Repeat 5.2 -> added: 0, 2 entries in skipped.
-- 5.4 Repeat with " toothbrush " / "toiletries" -> skipped. No new category is created.
-- 5.5 add_usual_items_to_trip on a test trip with Noa's toothbrush mapped to the Noa participant -> added: 1.
--     Running it again -> skipped: 1.
-- 5.6 Insert the same item directly into packing_items, then call add_usual_items_to_trip for it -> skipped, not duplicated.
-- 5.7 seed_trip_categories_from_usual on a trip with no categories -> copies the user's categories.
--     With an empty usual list -> the four fixed categories with icons.
