-- Trip invitations: pending invites by email. Access is granted only via trip_members when accepted.
-- Additive migration; does not modify existing tables.

create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  role text not null,
  status text not null default 'pending',
  token_hash text not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz null,
  accepted_at timestamptz null,
  accepted_by_user_id uuid null references auth.users(id) on delete set null,
  revoked_at timestamptz null,

  constraint trip_invitations_role_check check (role in ('admin', 'editor', 'viewer')),
  constraint trip_invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint trip_invitations_email_normalized_check check (email_normalized = lower(trim(email_normalized)))
);

comment on table public.trip_invitations is 'Pending and historical trip invitations by email; access is granted via trip_members on accept.';

-- Partial unique index: at most one pending invitation per (trip_id, email_normalized)
create unique index idx_trip_invitations_trip_email_pending
  on public.trip_invitations (trip_id, email_normalized)
  where status = 'pending';

-- Lookup by email + status (e.g. find pending invites for an email)
create index idx_trip_invitations_email_normalized_status
  on public.trip_invitations (email_normalized, status);

-- Lookup by trip + status (e.g. list pending invites for a trip)
create index idx_trip_invitations_trip_id_status
  on public.trip_invitations (trip_id, status);

-- Minimal updated_at trigger (project has no existing trigger pattern)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trip_invitations_updated_at
  before update on public.trip_invitations
  for each row
  execute function public.set_updated_at();
