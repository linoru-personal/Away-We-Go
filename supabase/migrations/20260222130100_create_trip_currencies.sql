-- Per-trip currencies (shared between trip members). RLS via public.has_trip_access(trip_id).
-- Table may already exist from 20260222120000_trip_currencies_and_exchange_rates; this migration is idempotent.

create table if not exists public.trip_currencies (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  currency text not null,
  created_at timestamptz default now(),
  unique (trip_id, currency)
);

create index if not exists idx_trip_currencies_trip_id on public.trip_currencies(trip_id);

alter table public.trip_currencies enable row level security;

-- Ensure only SELECT, INSERT, DELETE (drop update if present from earlier migration)
drop policy if exists "trip_currencies_update" on public.trip_currencies;
drop policy if exists "trip_currencies_select" on public.trip_currencies;
drop policy if exists "trip_currencies_insert" on public.trip_currencies;
drop policy if exists "trip_currencies_delete" on public.trip_currencies;

create policy "trip_currencies_select"
  on public.trip_currencies for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_currencies_insert"
  on public.trip_currencies for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_currencies_delete"
  on public.trip_currencies for delete to authenticated
  using (public.has_trip_access(trip_id));
