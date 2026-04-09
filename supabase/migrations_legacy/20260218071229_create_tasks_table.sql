create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid(),

  title text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  assignee text not null default 'Unassigned',

  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using (user_id = auth.uid());

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check (user_id = auth.uid());

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using (user_id = auth.uid());
