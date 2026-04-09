-- Core tables: primary keys and unique constraints (no foreign keys yet).

create table if not exists public.trips (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  start_date date,
  end_date date,
  cover_image_url text,
  created_at timestamp with time zone default now(),
  destination text,
  cover_image_path text,
  destination_image_url text,
  constraint trips_pkey primary key (id)
);

create table if not exists public.profiles (
  id uuid not null,
  username text,
  constraint profiles_pkey primary key (id)
);

comment on table public.profiles is
  'User profile: username (unique). Existing users may have no row; app uses email prefix as fallback.';

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.trip_members (
  trip_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  role text not null default 'viewer',
  constraint trip_members_pkey primary key (trip_id, user_id),
  constraint trip_members_role_check check (
    role = any (array['admin'::text, 'editor'::text, 'viewer'::text])
  )
);

create table if not exists public.trip_invitations (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  email text not null,
  email_normalized text not null,
  role text not null,
  status text not null default 'pending',
  token_hash text not null,
  invited_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  accepted_by_user_id uuid,
  revoked_at timestamp with time zone,
  constraint trip_invitations_pkey primary key (id),
  constraint trip_invitations_email_normalized_check check (
    email_normalized = lower(trim(both from email_normalized))
  ),
  constraint trip_invitations_role_check check (
    role = any (array['admin'::text, 'editor'::text, 'viewer'::text])
  ),
  constraint trip_invitations_status_check check (
    status = any (
      array[
        'pending'::text,
        'accepted'::text,
        'revoked'::text,
        'expired'::text
      ]
    )
  )
);

comment on table public.trip_invitations is
  'Pending and historical trip invitations by email; access is granted via trip_members on accept.';

create table if not exists public.trip_participants (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  name text not null,
  avatar_path text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint trip_participants_pkey primary key (id)
);

-- Required before fk_editable_image_assets_avatar_trip (migration 03): composite FK targets (trip_id, id).
create unique index if not exists idx_trip_participants_trip_id_id
  on public.trip_participants using btree (trip_id, id);

create table if not exists public.editable_image_assets (
  id uuid not null default gen_random_uuid(),
  owner_type text not null,
  trip_id uuid not null,
  participant_id uuid,
  original_path text not null,
  cropped_path text not null,
  crop_metadata jsonb,
  aspect_preset text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint editable_image_assets_pkey primary key (id),
  constraint chk_participant_avatar_has_participant check (
    (
      owner_type = 'participant_avatar'::text
      and participant_id is not null
    )
    or (
      owner_type = any (
        array['trip_cover'::text, 'destination_cover'::text]
      )
      and participant_id is null
    )
  ),
  constraint editable_image_assets_owner_type_check check (
    owner_type = any (
      array[
        'trip_cover'::text,
        'destination_cover'::text,
        'participant_avatar'::text
      ]
    )
  )
);

comment on column public.editable_image_assets.owner_type is
  'Image type: trip_cover | destination_cover | participant_avatar';
comment on column public.editable_image_assets.original_path is
  'Storage path to the original uploaded file (for re-crop from any device)';
comment on column public.editable_image_assets.cropped_path is
  'Storage path to the cropped derivative used by the UI';
comment on column public.editable_image_assets.crop_metadata is
  'Crop rect and zoom, e.g. { "x": 0, "y": 0, "width": 800, "height": 300, "zoom": 1 }';
comment on column public.editable_image_assets.aspect_preset is
  'Aspect preset key, e.g. hero_16_6, avatar_1_1';

create table if not exists public.packing_categories (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  created_by uuid not null default auth.uid(),
  constraint packing_categories_pkey primary key (id)
);

create table if not exists public.packing_items (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  category_id uuid not null,
  title text not null,
  quantity integer not null default 1,
  is_packed boolean not null default false,
  assigned_to_user_id uuid,
  notes text,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  assigned_to_participant_id uuid,
  sort_order integer not null default 0,
  constraint packing_items_pkey primary key (id),
  constraint packing_items_quantity_check check (quantity >= 1)
);

create table if not exists public.tasks (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null default auth.uid(),
  title text not null,
  status text not null default 'todo',
  assignee text not null default 'Unassigned',
  created_at timestamp with time zone not null default now(),
  description text,
  sort_order integer not null default 0,
  constraint tasks_pkey primary key (id),
  constraint tasks_status_check check (status = any (array['todo'::text, 'done'::text]))
);

create table if not exists public.trip_budget_categories (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  name text not null,
  color text not null,
  icon text not null,
  created_at timestamp with time zone default now(),
  sort_order integer not null default 0,
  constraint trip_budget_categories_pkey primary key (id),
  constraint trip_budget_categories_trip_id_name_key unique (trip_id, name)
);

create table if not exists public.trip_budget_items (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  category_id uuid,
  name text not null,
  amount numeric not null,
  currency text not null,
  amount_base numeric not null,
  base_currency text not null,
  fx_rate numeric not null,
  date date,
  notes text,
  created_at timestamp with time zone default now(),
  sort_order integer not null default 0,
  constraint trip_budget_items_pkey primary key (id)
);

create table if not exists public.trip_currencies (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  currency text not null,
  created_at timestamp with time zone default now(),
  constraint trip_currencies_pkey primary key (id),
  constraint trip_currencies_trip_id_currency_key unique (trip_id, currency)
);

create table if not exists public.trip_exchange_rates (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  from_currency text not null,
  to_currency text not null default 'USD',
  rate numeric not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint trip_exchange_rates_pkey primary key (id),
  constraint trip_exchange_rates_trip_id_from_currency_to_currency_key unique (
    trip_id,
    from_currency,
    to_currency
  )
);

create table if not exists public.trip_notes (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  title text not null,
  content jsonb,
  tags text[],
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  sort_order integer not null default 0,
  constraint trip_notes_pkey primary key (id)
);

create table if not exists public.trip_photos (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  added_by_user_id uuid not null,
  image_path text not null,
  caption text,
  created_at timestamp with time zone not null default now(),
  taken_at timestamp with time zone,
  sort_at timestamp with time zone generated always as (coalesce(taken_at, created_at)) stored,
  constraint trip_photos_pkey primary key (id)
);

comment on column public.trip_photos.taken_at is
  'When the photo was taken (EXIF when available, else null; sort uses created_at fallback).';

create table if not exists public.trip_place_categories (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  name text not null,
  icon text,
  created_at timestamp with time zone not null default now(),
  sort_order integer not null default 0,
  constraint trip_place_categories_pkey primary key (id),
  constraint trip_place_categories_trip_id_name_key unique (trip_id, name)
);

create table if not exists public.trip_places (
  id uuid not null default gen_random_uuid(),
  trip_id uuid not null,
  added_by_user_id uuid not null,
  title text not null,
  google_maps_url text not null,
  notes text,
  created_at timestamp with time zone not null default now(),
  category_id uuid,
  sort_order integer not null default 0,
  google_place_id text,
  formatted_address text,
  lat double precision,
  lng double precision,
  constraint trip_places_pkey primary key (id)
);
