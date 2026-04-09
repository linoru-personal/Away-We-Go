-- Phase 1: Add role column to trip_members for permission model (admin, editor, viewer).
-- Default for new members is 'viewer'; existing rows backfilled to 'editor' to preserve current behavior.
-- No RLS or application changes in this migration.

-- Add column (existing rows get default 'viewer' in PostgreSQL)
alter table public.trip_members
  add column if not exists role text not null default 'viewer';

-- Backfill: existing members treated as editors so behavior is unchanged until RLS is updated
update public.trip_members
set role = 'editor'
where role = 'viewer';

-- Constrain to allowed roles (idempotent: drop if exists, e.g. re-run)
alter table public.trip_members
  drop constraint if exists trip_members_role_check;
alter table public.trip_members
  add constraint trip_members_role_check check (role in ('admin', 'editor', 'viewer'));

-- Ensure default for future inserts is 'viewer' (already is from add column)
alter table public.trip_members
  alter column role set default 'viewer';
