-- Personal packing list templates (MVP: per-user; sharing can be added later).

create table if not exists public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packing_templates_name_not_empty check (char_length(trim(name)) > 0)
);

create table if not exists public.packing_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.packing_templates (id) on delete cascade,
  name text not null,
  category text,
  assigned_to text,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint packing_template_items_name_not_empty check (char_length(trim(name)) > 0),
  constraint packing_template_items_quantity_check check (quantity >= 1)
);

comment on table public.packing_templates is
  'Per-user reusable packing lists. Items stored in packing_template_items.';
comment on column public.packing_template_items.category is
  'Category name snapshot (matches trip packing_categories.name, not a FK).';
comment on column public.packing_template_items.assigned_to is
  'Assignee display name snapshot; empty/null means Everyone.';

create index if not exists idx_packing_templates_user_id
  on public.packing_templates (user_id);

create index if not exists idx_packing_template_items_template_id
  on public.packing_template_items (template_id);

create trigger packing_templates_updated_at
  before update on public.packing_templates
  for each row
  execute function public.set_updated_at();

-- RLS helper: parent template owned by current user
create or replace function public.packing_template_owned_by_user(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
set row_security to off
as $$
  select exists (
    select 1
    from public.packing_templates t
    where t.id = p_template_id
      and t.user_id = auth.uid()
  );
$$;

grant execute on function public.packing_template_owned_by_user(uuid) to authenticated, service_role;

alter table public.packing_templates enable row level security;
alter table public.packing_template_items enable row level security;

create policy packing_templates_select_own on public.packing_templates
  for select to authenticated
  using (user_id = auth.uid());

create policy packing_templates_insert_own on public.packing_templates
  for insert to authenticated
  with check (user_id = auth.uid());

create policy packing_templates_update_own on public.packing_templates
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy packing_templates_delete_own on public.packing_templates
  for delete to authenticated
  using (user_id = auth.uid());

create policy packing_template_items_select_own on public.packing_template_items
  for select to authenticated
  using (public.packing_template_owned_by_user(template_id));

create policy packing_template_items_insert_own on public.packing_template_items
  for insert to authenticated
  with check (public.packing_template_owned_by_user(template_id));

create policy packing_template_items_update_own on public.packing_template_items
  for update to authenticated
  using (public.packing_template_owned_by_user(template_id))
  with check (public.packing_template_owned_by_user(template_id));

create policy packing_template_items_delete_own on public.packing_template_items
  for delete to authenticated
  using (public.packing_template_owned_by_user(template_id));

grant all on table public.packing_templates to authenticated, service_role;
grant all on table public.packing_template_items to authenticated, service_role;
