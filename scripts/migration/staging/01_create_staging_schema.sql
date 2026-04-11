-- =============================================================================
-- Target DB: create migration_staging.* mirrors of public trip-related tables
-- =============================================================================
-- Run once on TARGET before loading CSV (or before streaming rows into staging).
--
-- Tables are created LIKE public.* INCLUDING ALL, then ALL foreign keys on
-- staging are dropped so you can load rows in any order without touching
-- public yet. Primary keys and CHECK constraints remain (fail fast on bad CSV).
--
-- Does not touch public.* data.
-- =============================================================================

create schema if not exists migration_staging;

create table migration_staging.trips (like public.trips including all);
create table migration_staging.trip_members (like public.trip_members including all);
create table migration_staging.trip_participants (like public.trip_participants including all);
create table migration_staging.trip_invitations (like public.trip_invitations including all);
create table migration_staging.tasks (like public.tasks including all);
create table migration_staging.trip_notes (like public.trip_notes including all);
create table migration_staging.packing_categories (like public.packing_categories including all);
create table migration_staging.packing_items (like public.packing_items including all);
create table migration_staging.trip_budget_categories (like public.trip_budget_categories including all);
create table migration_staging.trip_budget_items (like public.trip_budget_items including all);
create table migration_staging.trip_currencies (like public.trip_currencies including all);
create table migration_staging.trip_exchange_rates (like public.trip_exchange_rates including all);
create table migration_staging.trip_place_categories (like public.trip_place_categories including all);
create table migration_staging.trip_places (like public.trip_places including all);

do $$
declare
  r record;
begin
  for r in
    select c.conname, t.relname as tbl
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'migration_staging'
      and c.contype = 'f'
  loop
    execute format(
      'alter table migration_staging.%I drop constraint if exists %I',
      r.tbl,
      r.conname
    );
  end loop;
end;
$$;

comment on schema migration_staging is
  'Short-lived hold for trip migration rows. Load via COPY, then run 02_apply_staging_to_public.sql.';
