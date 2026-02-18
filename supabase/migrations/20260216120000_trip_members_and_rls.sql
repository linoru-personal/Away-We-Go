-- Trip sharing: trip_members table + helper functions + RLS
-- Assumes: trips exists with user_id (owner); tasks has trip_id FK; RLS enabled on both.

-- 1) trip_members table
create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists idx_trip_members_trip_id on public.trip_members(trip_id);
create index if not exists idx_trip_members_user_id on public.trip_members(user_id);

alter table public.trip_members enable row level security;

-- 2) Helper functions (use trips.user_id as owner)
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.has_trip_access(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid()
     );
$$;

-- 3) Drop existing policies on tasks (known from create_tasks migration)
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

-- 4) Drop all existing policies on trips (names may vary)
do $$
declare
  r record;
begin
  for r in (select policyname from pg_policies where schemaname = 'public' and tablename = 'trips')
  loop
    execute format('drop policy if exists %I on public.trips', r.policyname);
  end loop;
end $$;

-- 5) Trips policies
create policy "trips_select"
  on public.trips for select to authenticated
  using (public.has_trip_access(id));

create policy "trips_insert"
  on public.trips for insert to authenticated
  with check (user_id = auth.uid());

create policy "trips_update"
  on public.trips for update to authenticated
  using (public.has_trip_access(id));

create policy "trips_delete"
  on public.trips for delete to authenticated
  using (public.is_trip_owner(id));

-- 6) Tasks policies (access by trip, not by task user_id)
create policy "tasks_select"
  on public.tasks for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "tasks_update"
  on public.tasks for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "tasks_delete"
  on public.tasks for delete to authenticated
  using (public.has_trip_access(trip_id));

-- 7) trip_members policies
create policy "trip_members_select"
  on public.trip_members for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_members_insert"
  on public.trip_members for insert to authenticated
  with check (public.is_trip_owner(trip_id));

create policy "trip_members_delete"
  on public.trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- Grant execute on helpers to authenticated (for optional use from app)
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.has_trip_access(uuid) to authenticated;
