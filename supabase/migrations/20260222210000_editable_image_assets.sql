-- Editable image assets: original + crop metadata + cropped derivative for cross-device re-cropping.
-- Supports: trip cover, destination cover, participant avatar.
-- Existing columns (trips.cover_image_path, trips.destination_image_url, trip_participants.avatar_path)
-- remain unchanged for backward compatibility; this table is additive.

create table if not exists public.editable_image_assets (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('trip_cover', 'destination_cover', 'participant_avatar')),
  trip_id uuid not null references public.trips(id) on delete cascade,
  participant_id uuid references public.trip_participants(id) on delete cascade,
  original_path text not null,
  cropped_path text not null,
  crop_metadata jsonb,
  aspect_preset text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_participant_avatar_has_participant
    check (
      (owner_type = 'participant_avatar' and participant_id is not null)
      or (owner_type in ('trip_cover', 'destination_cover') and participant_id is null)
    )
);

comment on column public.editable_image_assets.owner_type is 'Image type: trip_cover | destination_cover | participant_avatar';
comment on column public.editable_image_assets.original_path is 'Storage path to the original uploaded file (for re-crop from any device)';
comment on column public.editable_image_assets.cropped_path is 'Storage path to the cropped derivative used by the UI';
comment on column public.editable_image_assets.crop_metadata is 'Crop rect and zoom, e.g. { "x": 0, "y": 0, "width": 800, "height": 300, "zoom": 1 }';
comment on column public.editable_image_assets.aspect_preset is 'Aspect preset key, e.g. hero_16_6, avatar_1_1';

-- One editable asset per (trip, owner_type) for trip_cover and destination_cover
create unique index idx_editable_image_assets_trip_owner
  on public.editable_image_assets (trip_id, owner_type)
  where participant_id is null;

-- One editable asset per participant for avatars
create unique index idx_editable_image_assets_participant_avatar
  on public.editable_image_assets (participant_id)
  where owner_type = 'participant_avatar';

create index idx_editable_image_assets_trip_id
  on public.editable_image_assets (trip_id);

create index idx_editable_image_assets_participant_id
  on public.editable_image_assets (participant_id)
  where participant_id is not null;

alter table public.editable_image_assets enable row level security;

-- SELECT: anyone with trip access can read (to display cropped image, fetch original for re-crop)
create policy "editable_image_assets_select"
  on public.editable_image_assets for select to authenticated
  using (public.has_trip_access(trip_id));

-- INSERT/UPDATE/DELETE: only owner or admin (same as trip metadata / participants)
create policy "editable_image_assets_insert"
  on public.editable_image_assets for insert to authenticated
  with check (public.can_edit_trip_metadata(trip_id));

create policy "editable_image_assets_update"
  on public.editable_image_assets for update to authenticated
  using (public.can_edit_trip_metadata(trip_id))
  with check (public.can_edit_trip_metadata(trip_id));

create policy "editable_image_assets_delete"
  on public.editable_image_assets for delete to authenticated
  using (public.can_edit_trip_metadata(trip_id));

-- Keep updated_at in sync
create or replace function public.set_editable_image_assets_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger editable_image_assets_updated_at
  before update on public.editable_image_assets
  for each row
  execute function public.set_editable_image_assets_updated_at();
