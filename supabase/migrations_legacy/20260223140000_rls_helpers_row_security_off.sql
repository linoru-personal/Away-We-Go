-- Ensure trip permission helpers read trips / trip_members without RLS re-evaluation
-- as the invoker. If a SECURITY DEFINER function is owned by a role that does not
-- bypass RLS on those tables, membership checks inside has_trip_access can fail and
-- viewers see 0 rows on trips (PostgREST: PGRST116 / "Cannot coerce...").
-- SET row_security = off applies for the duration of each function call.

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
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
set row_security = off
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid()
     );
$$;

create or replace function public.can_manage_trip_sharing(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

create or replace function public.can_edit_trip_metadata(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'admin'
     );
$$;

create or replace function public.can_edit_trip_content(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select public.is_trip_owner(p_trip_id)
     or exists (
       select 1 from public.trip_members m
       where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role in ('admin', 'editor')
     );
$$;
