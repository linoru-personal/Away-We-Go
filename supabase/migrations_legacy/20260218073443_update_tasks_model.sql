-- 1. Remove in_progress option from status constraint
alter table public.tasks
drop constraint if exists tasks_status_check;

alter table public.tasks
add constraint tasks_status_check
check (status in ('todo','done'));

-- 2. Add description field
alter table public.tasks
add column if not exists description text;

-- 3. Optional: set default status to 'todo' explicitly
alter table public.tasks
alter column status set default 'todo';
