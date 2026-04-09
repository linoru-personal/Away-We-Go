-- Per-trip custom currencies and exchange rates. RLS via public.has_trip_access(trip_id).

-- 1) trip_currencies
create table if not exists public.trip_currencies (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  currency text not null,
  created_at timestamptz default now(),
  unique (trip_id, currency)
);

create index if not exists idx_trip_currencies_trip_id on public.trip_currencies(trip_id);

alter table public.trip_currencies enable row level security;

create policy "trip_currencies_select"
  on public.trip_currencies for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_currencies_insert"
  on public.trip_currencies for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_currencies_update"
  on public.trip_currencies for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_currencies_delete"
  on public.trip_currencies for delete to authenticated
  using (public.has_trip_access(trip_id));

-- 2) trip_exchange_rates
create table if not exists public.trip_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_currency text not null,
  to_currency text not null default 'USD',
  rate numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trip_id, from_currency, to_currency)
);

create index if not exists idx_trip_exchange_rates_trip_id on public.trip_exchange_rates(trip_id);
create index if not exists idx_trip_exchange_rates_trip_id_from on public.trip_exchange_rates(trip_id, from_currency);

alter table public.trip_exchange_rates enable row level security;

create policy "trip_exchange_rates_select"
  on public.trip_exchange_rates for select to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_exchange_rates_insert"
  on public.trip_exchange_rates for insert to authenticated
  with check (public.has_trip_access(trip_id));

create policy "trip_exchange_rates_update"
  on public.trip_exchange_rates for update to authenticated
  using (public.has_trip_access(trip_id));

create policy "trip_exchange_rates_delete"
  on public.trip_exchange_rates for delete to authenticated
  using (public.has_trip_access(trip_id));
