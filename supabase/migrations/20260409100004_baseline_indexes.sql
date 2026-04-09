-- Performance indexes (matches schema.sql).

create unique index if not exists idx_editable_image_assets_participant_avatar
  on public.editable_image_assets using btree (participant_id)
  where owner_type = 'participant_avatar'::text;

create index if not exists idx_editable_image_assets_participant_id
  on public.editable_image_assets using btree (participant_id)
  where participant_id is not null;

create index if not exists idx_editable_image_assets_trip_id
  on public.editable_image_assets using btree (trip_id);

create unique index if not exists idx_editable_image_assets_trip_owner
  on public.editable_image_assets using btree (trip_id, owner_type)
  where participant_id is null;

create index if not exists idx_packing_categories_trip_id
  on public.packing_categories using btree (trip_id);

create index if not exists idx_packing_items_assigned_to_participant_id
  on public.packing_items using btree (assigned_to_participant_id);

create index if not exists idx_packing_items_category_id
  on public.packing_items using btree (category_id);

create index if not exists idx_packing_items_trip_id on public.packing_items using btree (trip_id);

create index if not exists idx_packing_items_trip_id_sort_order
  on public.packing_items using btree (trip_id, sort_order);

create index if not exists idx_tasks_trip_id_sort_order on public.tasks using btree (trip_id, sort_order);

create index if not exists idx_trip_budget_categories_trip_id
  on public.trip_budget_categories using btree (trip_id);

create index if not exists idx_trip_budget_categories_trip_id_sort_order
  on public.trip_budget_categories using btree (trip_id, sort_order);

create index if not exists idx_trip_budget_items_category_id
  on public.trip_budget_items using btree (category_id);

create index if not exists idx_trip_budget_items_trip_id on public.trip_budget_items using btree (trip_id);

create index if not exists idx_trip_budget_items_trip_id_created_at
  on public.trip_budget_items using btree (trip_id, created_at desc);

create index if not exists idx_trip_budget_items_trip_id_sort_order
  on public.trip_budget_items using btree (trip_id, sort_order);

create index if not exists idx_trip_currencies_trip_id on public.trip_currencies using btree (trip_id);

create index if not exists idx_trip_exchange_rates_trip_id
  on public.trip_exchange_rates using btree (trip_id);

create index if not exists idx_trip_exchange_rates_trip_id_from
  on public.trip_exchange_rates using btree (trip_id, from_currency);

create index if not exists idx_trip_invitations_email_normalized_status
  on public.trip_invitations using btree (email_normalized, status);

create unique index if not exists idx_trip_invitations_trip_email_pending
  on public.trip_invitations using btree (trip_id, email_normalized)
  where status = 'pending'::text;

create index if not exists idx_trip_invitations_trip_id_status
  on public.trip_invitations using btree (trip_id, status);

create index if not exists idx_trip_members_trip_id on public.trip_members using btree (trip_id);

create index if not exists idx_trip_members_user_id on public.trip_members using btree (user_id);

create index if not exists idx_trip_notes_trip_id on public.trip_notes using btree (trip_id);

create index if not exists idx_trip_notes_trip_id_created_at
  on public.trip_notes using btree (trip_id, created_at desc);

create index if not exists idx_trip_notes_trip_id_sort_order
  on public.trip_notes using btree (trip_id, sort_order);

create index if not exists idx_trip_participants_trip_id
  on public.trip_participants using btree (trip_id);

-- idx_trip_participants_trip_id_id: created in 02 (before composite FK in 03).

create index if not exists idx_trip_photos_trip_id on public.trip_photos using btree (trip_id);

create index if not exists idx_trip_photos_trip_sort_at on public.trip_photos using btree (trip_id, sort_at);

create index if not exists idx_trip_place_categories_trip_id
  on public.trip_place_categories using btree (trip_id);

create index if not exists idx_trip_place_categories_trip_id_sort_order
  on public.trip_place_categories using btree (trip_id, sort_order);

create index if not exists idx_trip_places_category_id on public.trip_places using btree (category_id);

create index if not exists idx_trip_places_trip_id on public.trip_places using btree (trip_id);

create index if not exists idx_trip_places_trip_id_created_at
  on public.trip_places using btree (trip_id, created_at desc);

create index if not exists idx_trip_places_trip_id_sort_order
  on public.trip_places using btree (trip_id, sort_order);

-- packing_categories_trip_id_idx removed: duplicate of idx_packing_categories_trip_id (same btree on trip_id).

create unique index if not exists packing_categories_trip_name_unique
  on public.packing_categories using btree (trip_id, lower(name));
