-- Phase 4: Content and storage RLS — viewer read-only; only owner/admin/editor can mutate.
-- All trip content tables and content/metadata storage: insert/update/delete use
-- can_edit_trip_content (content) or can_edit_trip_metadata (covers, avatars).
-- Select remains has_trip_access everywhere. Trip delete is unchanged (owner-only).
-- Assumes: can_edit_trip_content(uuid), can_edit_trip_metadata(uuid) exist.

-- ----- Content tables: insert/update/delete = can_edit_trip_content(trip_id) -----

-- tasks
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "tasks_update"
  on public.tasks for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "tasks_delete"
  on public.tasks for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_notes
drop policy if exists "trip_notes_insert" on public.trip_notes;
drop policy if exists "trip_notes_update" on public.trip_notes;
drop policy if exists "trip_notes_delete" on public.trip_notes;
create policy "trip_notes_insert"
  on public.trip_notes for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_notes_update"
  on public.trip_notes for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_notes_delete"
  on public.trip_notes for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_places
drop policy if exists "trip_places_insert" on public.trip_places;
drop policy if exists "trip_places_update" on public.trip_places;
drop policy if exists "trip_places_delete" on public.trip_places;
create policy "trip_places_insert"
  on public.trip_places for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_places_update"
  on public.trip_places for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_places_delete"
  on public.trip_places for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_place_categories
drop policy if exists "trip_place_categories_insert" on public.trip_place_categories;
drop policy if exists "trip_place_categories_update" on public.trip_place_categories;
drop policy if exists "trip_place_categories_delete" on public.trip_place_categories;
create policy "trip_place_categories_insert"
  on public.trip_place_categories for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_place_categories_update"
  on public.trip_place_categories for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_place_categories_delete"
  on public.trip_place_categories for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_photos
drop policy if exists "trip_photos_insert" on public.trip_photos;
drop policy if exists "trip_photos_update" on public.trip_photos;
drop policy if exists "trip_photos_delete" on public.trip_photos;
create policy "trip_photos_insert"
  on public.trip_photos for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_photos_update"
  on public.trip_photos for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_photos_delete"
  on public.trip_photos for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_budget_categories
drop policy if exists "trip_budget_categories_insert" on public.trip_budget_categories;
drop policy if exists "trip_budget_categories_update" on public.trip_budget_categories;
drop policy if exists "trip_budget_categories_delete" on public.trip_budget_categories;
create policy "trip_budget_categories_insert"
  on public.trip_budget_categories for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_budget_categories_update"
  on public.trip_budget_categories for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_budget_categories_delete"
  on public.trip_budget_categories for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_budget_items
drop policy if exists "trip_budget_items_insert" on public.trip_budget_items;
drop policy if exists "trip_budget_items_update" on public.trip_budget_items;
drop policy if exists "trip_budget_items_delete" on public.trip_budget_items;
create policy "trip_budget_items_insert"
  on public.trip_budget_items for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_budget_items_update"
  on public.trip_budget_items for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_budget_items_delete"
  on public.trip_budget_items for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_currencies (idempotent: some envs may have update policy, some not)
drop policy if exists "trip_currencies_insert" on public.trip_currencies;
drop policy if exists "trip_currencies_update" on public.trip_currencies;
drop policy if exists "trip_currencies_delete" on public.trip_currencies;
create policy "trip_currencies_insert"
  on public.trip_currencies for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_currencies_update"
  on public.trip_currencies for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_currencies_delete"
  on public.trip_currencies for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- trip_exchange_rates
drop policy if exists "trip_exchange_rates_insert" on public.trip_exchange_rates;
drop policy if exists "trip_exchange_rates_update" on public.trip_exchange_rates;
drop policy if exists "trip_exchange_rates_delete" on public.trip_exchange_rates;
create policy "trip_exchange_rates_insert"
  on public.trip_exchange_rates for insert to authenticated
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_exchange_rates_update"
  on public.trip_exchange_rates for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));
create policy "trip_exchange_rates_delete"
  on public.trip_exchange_rates for delete to authenticated
  using (public.can_edit_trip_content(trip_id));

-- ----- Storage: content buckets = can_edit_trip_content; metadata = can_edit_trip_metadata -----
-- Path format: first folder segment is trip_id (e.g. trip_id/filename).

-- trip-notes (content)
drop policy if exists "trip_notes_insert" on storage.objects;
drop policy if exists "trip_notes_update" on storage.objects;
drop policy if exists "trip_notes_delete" on storage.objects;
create policy "trip_notes_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-notes'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );
create policy "trip_notes_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-notes'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );
create policy "trip_notes_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-notes'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );

-- trip-photos (content)
drop policy if exists "trip_photos_insert" on storage.objects;
drop policy if exists "trip_photos_update" on storage.objects;
drop policy if exists "trip_photos_delete" on storage.objects;
create policy "trip_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );
create policy "trip_photos_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );
create policy "trip_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.can_edit_trip_content((storage.foldername(name))[1]::uuid)
  );

-- trip-covers (metadata: owner or admin)
drop policy if exists "trip_covers_insert" on storage.objects;
drop policy if exists "trip_covers_update" on storage.objects;
drop policy if exists "trip_covers_delete" on storage.objects;
create policy "trip_covers_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-covers'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );
create policy "trip_covers_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );
create policy "trip_covers_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );

-- avatars (metadata: owner or admin)
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );
create policy "avatars_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );
create policy "avatars_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_edit_trip_metadata((storage.foldername(name))[1]::uuid)
  );
