-- Trip Budget: categories and line items. RLS via public.has_trip_access(trip_id).

-- 1) trip_budget_categories
create table if not exists public.trip_budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  created_at timestamptz default now(),
  unique (trip_id, name)
);

create index if not exists idx_trip_budget_categories_trip_id on public.trip_budget_categories(trip_id);

alter table public.trip_budget_categories enable row level security;

create policy "trip_budget_categories_select"
  on public.trip_budget_categories for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_budget_categories_insert"
  on public.trip_budget_categories for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_budget_categories_update"
  on public.trip_budget_categories for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_budget_categories_delete"
  on public.trip_budget_categories for delete to authenticated
  using (public.has_trip_access(trip_id));

-- 2) trip_budget_items
create table if not exists public.trip_budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid references public.trip_budget_categories(id) on delete set null,
  name text not null,
  amount numeric not null,
  currency text not null,
  amount_base numeric not null,
  base_currency text not null,
  fx_rate numeric not null,
  date date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_trip_budget_items_trip_id on public.trip_budget_items(trip_id);
create index if not exists idx_trip_budget_items_category_id on public.trip_budget_items(category_id);
create index if not exists idx_trip_budget_items_trip_id_created_at on public.trip_budget_items(trip_id, created_at desc);

alter table public.trip_budget_items enable row level security;

create policy "trip_budget_items_select"
  on public.trip_budget_items for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_budget_items_insert"
  on public.trip_budget_items for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_budget_items_update"
  on public.trip_budget_items for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_budget_items_delete"
  on public.trip_budget_items for delete to authenticated
  using (public.has_trip_access(trip_id));
