-- =============================================================================
-- NEW: Trip media (Storage + additive DB columns)
-- =============================================================================
-- Source of truth: docs/IMAGE_STORAGE_IMPLEMENTATION_DECISIONS.md
--
-- This migration is ADDITIVE ONLY:
--   - Creates private bucket trip-media (if missing)
--   - Adds storage.objects policies (does not drop unrelated policies)
--   - Adds public.*.media jsonb columns
--   - Adds small NEW helper functions (namespaced; does not replace RLS helpers)
--   - Adds COMMENTs only on public columns/functions (documentation; no DDL change to columns)
--
-- Does NOT: drop/alter columns, modify has_trip_access / can_edit_* / other
--           public table RLS policies, or change existing functions.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Storage — bucket
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('trip-media', 'trip-media', false)
on conflict (id) do update
set
  public = false,
  name   = excluded.name;


-- =============================================================================
-- SECTION 2: Helpers (NEW functions only; safe path parsing)
-- =============================================================================
-- Used by storage policies to avoid invalid UUID casts on malformed names.

create or replace function public.trip_storage_object_trip_id(object_name text)
returns uuid
language plpgsql
stable
set search_path to public
as $$
declare
  seg text;
begin
  if object_name is null then
    return null;
  end if;
  seg := split_part(object_name, '/', 1);
  if seg is null or btrim(seg) = '' then
    return null;
  end if;
  return seg::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

comment on function public.trip_storage_object_trip_id(text) is
  'NEW: Extract trip_id (UUID) from first path segment of a storage object key under bucket trip-media. Returns NULL if missing/invalid.';

create or replace function public.trip_storage_object_class(object_name text)
returns text
language sql
stable
set search_path to public
as $$
  select nullif(split_part(object_name, '/', 2), '');
$$;

comment on function public.trip_storage_object_class(text) is
  'NEW: Extract class segment (second path component: cover|participants|photos|editable) from storage object key.';

grant execute on function public.trip_storage_object_trip_id(text) to authenticated, service_role;
grant execute on function public.trip_storage_object_class(text) to authenticated, service_role;


-- =============================================================================
-- SECTION 3: Storage — policies on storage.objects
-- =============================================================================
-- Trip id = first path segment (see docs). Class = second segment.
-- SELECT: any authenticated member with trip access may read.
-- WRITE: metadata classes → can_edit_trip_metadata; photos → can_edit_trip_content.
--
-- Idempotent: drop policies by these exact names if re-applied in a branch DB.

drop policy if exists "trip_media_select_authenticated" on storage.objects;
drop policy if exists "trip_media_insert_authenticated" on storage.objects;
drop policy if exists "trip_media_update_authenticated" on storage.objects;
drop policy if exists "trip_media_delete_authenticated" on storage.objects;

-- NEW: read objects under trip-media for trips the user can access
create policy "trip_media_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and public.has_trip_access(public.trip_storage_object_trip_id(name))
);

-- NEW: create objects (upload)
create policy "trip_media_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);

-- NEW: replace / metadata updates on existing keys
create policy "trip_media_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
)
with check (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);

-- NEW: remove objects
create policy "trip_media_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-media'
  and public.trip_storage_object_trip_id(name) is not null
  and (
    (
      public.trip_storage_object_class(name) in ('cover', 'participants', 'editable')
      and public.can_edit_trip_metadata(public.trip_storage_object_trip_id(name))
    )
    or (
      public.trip_storage_object_class(name) = 'photos'
      and public.can_edit_trip_content(public.trip_storage_object_trip_id(name))
    )
  )
);


-- =============================================================================
-- SECTION 4: Database — additive columns (media jsonb)
-- =============================================================================

alter table public.trips
  add column if not exists media jsonb;

comment on column public.trips.media is
  'NEW: Canonical trip cover / image metadata (variants, revision, status) per docs/IMAGE_STORAGE_IMPLEMENTATION_DECISIONS.md. Nullable until populated by app.';

alter table public.trip_participants
  add column if not exists media jsonb;

comment on column public.trip_participants.media is
  'NEW: Participant avatar metadata (variants, revision, status). Nullable until populated.';

alter table public.trip_photos
  add column if not exists media jsonb;

comment on column public.trip_photos.media is
  'NEW: Gallery photo metadata (thumb/display paths, status). Nullable until populated.';

alter table public.editable_image_assets
  add column if not exists media jsonb;

comment on column public.editable_image_assets.media is
  'NEW: Extra variant metadata; original_path / cropped_path / crop_metadata remain source of truth for crop UX until app consolidates.';


-- =============================================================================
-- SECTION 5: Deprecation comments (documentation only; columns unchanged)
-- =============================================================================

comment on column public.trips.cover_image_url is
  'DEPRECATED for new work: prefer bucket trip-media + trips.media JSON (signed URLs only in UI). Column retained for backward compatibility.';

comment on column public.trips.cover_image_path is
  'DEPRECATED as sole source of truth: keep as legacy primary display path if set; new uploads should populate trips.media and optionally mirror hero path here during transition. Do not drop.';

comment on column public.trips.destination_image_url is
  'DEPRECATED for new work: prefer trips.media / dedicated destination fields in app plan. Column retained.';

comment on column public.trip_participants.avatar_path is
  'DEPRECATED as sole source of truth: keep for legacy display; new uploads should populate trip_participants.media and optionally mirror avatar variant path here during transition. Do not drop.';

comment on column public.trip_photos.image_path is
  'DEPRECATED as sole source of truth: keep for legacy display; new uploads should populate trip_photos.media and optionally mirror display variant path here during transition. Do not drop.';


-- =============================================================================
-- END
-- =============================================================================