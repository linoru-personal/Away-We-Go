-- Forward-only fix for fk_editable_image_assets_avatar_trip.
-- PostgreSQL requires that a FK reference columns with a UNIQUE (or PK) constraint.
-- trip_participants has PK(id) only; (trip_id, id) was not unique-constrained.
-- Step 1: Add UNIQUE(trip_id, id) on trip_participants (id is already unique, so this is a no-op semantically).
-- Step 2: Add the composite FK so participant_avatar rows enforce trip_id matches participant's trip.
-- Idempotent: safe if the failed migration (20260222211000) was skipped or never applied.

create unique index if not exists idx_trip_participants_trip_id_id
  on public.trip_participants (trip_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_editable_image_assets_avatar_trip'
    and conrelid = 'public.editable_image_assets'::regclass
  ) then
    alter table public.editable_image_assets
      add constraint fk_editable_image_assets_avatar_trip
      foreign key (trip_id, participant_id)
      references public.trip_participants (trip_id, id);
  end if;
end $$;

comment on constraint fk_editable_image_assets_avatar_trip on public.editable_image_assets is
  'For participant_avatar: ensures the participant belongs to this trip. No effect when participant_id is null.';
