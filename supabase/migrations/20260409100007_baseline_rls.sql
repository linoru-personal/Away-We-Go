-- Row level security (requires permission helper functions).

alter table public.editable_image_assets enable row level security;
alter table public.packing_categories enable row level security;
alter table public.packing_items enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.trip_budget_categories enable row level security;
alter table public.trip_budget_items enable row level security;
alter table public.trip_currencies enable row level security;
alter table public.trip_exchange_rates enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_notes enable row level security;
alter table public.trip_participants enable row level security;
alter table public.trip_photos enable row level security;
alter table public.trip_place_categories enable row level security;
alter table public.trip_places enable row level security;
alter table public.trips enable row level security;

create policy editable_image_assets_delete on public.editable_image_assets
  for delete to authenticated using (public.can_edit_trip_metadata(trip_id));

create policy editable_image_assets_insert on public.editable_image_assets
  for insert to authenticated with check (public.can_edit_trip_metadata(trip_id));

create policy editable_image_assets_select on public.editable_image_assets
  for select to authenticated using (public.has_trip_access(trip_id));

create policy editable_image_assets_update on public.editable_image_assets
  for update to authenticated
  using (public.can_edit_trip_metadata(trip_id))
  with check (public.can_edit_trip_metadata(trip_id));

create policy packing_categories_delete on public.packing_categories
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy packing_categories_insert on public.packing_categories
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy packing_categories_select on public.packing_categories
  for select to authenticated using (public.has_trip_access(trip_id));

create policy packing_categories_update on public.packing_categories
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy packing_items_delete on public.packing_items
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy packing_items_insert on public.packing_items
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy packing_items_select on public.packing_items
  for select to authenticated using (public.has_trip_access(trip_id));

create policy packing_items_update on public.packing_items
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy tasks_delete on public.tasks
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy tasks_select on public.tasks
  for select to authenticated using (public.has_trip_access(trip_id));

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_budget_categories_delete on public.trip_budget_categories
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_budget_categories_insert on public.trip_budget_categories
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_budget_categories_select on public.trip_budget_categories
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_budget_categories_update on public.trip_budget_categories
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_budget_items_delete on public.trip_budget_items
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_budget_items_insert on public.trip_budget_items
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_budget_items_select on public.trip_budget_items
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_budget_items_update on public.trip_budget_items
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_currencies_delete on public.trip_currencies
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_currencies_insert on public.trip_currencies
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_currencies_select on public.trip_currencies
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_currencies_update on public.trip_currencies
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_exchange_rates_delete on public.trip_exchange_rates
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_exchange_rates_insert on public.trip_exchange_rates
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_exchange_rates_select on public.trip_exchange_rates
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_exchange_rates_update on public.trip_exchange_rates
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_invitations_insert on public.trip_invitations
  for insert to authenticated
  with check (
    public.can_manage_trip_sharing(trip_id)
    and invited_by = auth.uid()
  );

create policy trip_invitations_select on public.trip_invitations
  for select to authenticated using (public.can_manage_trip_sharing(trip_id));

create policy trip_invitations_update on public.trip_invitations
  for update to authenticated
  using (public.can_manage_trip_sharing(trip_id))
  with check (public.can_manage_trip_sharing(trip_id));

create policy trip_members_delete on public.trip_members
  for delete to authenticated using (public.can_manage_trip_sharing(trip_id));

create policy trip_members_insert on public.trip_members
  for insert to authenticated with check (public.can_manage_trip_sharing(trip_id));

create policy trip_members_select on public.trip_members
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_members_update on public.trip_members
  for update to authenticated
  using (public.can_manage_trip_sharing(trip_id))
  with check (public.can_manage_trip_sharing(trip_id));

create policy trip_notes_delete on public.trip_notes
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_notes_insert on public.trip_notes
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_notes_select on public.trip_notes
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_notes_update on public.trip_notes
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_participants_delete on public.trip_participants
  for delete to authenticated using (public.can_edit_trip_metadata(trip_id));

create policy trip_participants_insert on public.trip_participants
  for insert to authenticated with check (public.can_edit_trip_metadata(trip_id));

create policy trip_participants_select on public.trip_participants
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_participants_update on public.trip_participants
  for update to authenticated
  using (public.can_edit_trip_metadata(trip_id))
  with check (public.can_edit_trip_metadata(trip_id));

create policy trip_photos_delete on public.trip_photos
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_photos_insert on public.trip_photos
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_photos_select on public.trip_photos
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_photos_update on public.trip_photos
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_place_categories_delete on public.trip_place_categories
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_place_categories_insert on public.trip_place_categories
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_place_categories_select on public.trip_place_categories
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_place_categories_update on public.trip_place_categories
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trip_places_delete on public.trip_places
  for delete to authenticated using (public.can_edit_trip_content(trip_id));

create policy trip_places_insert on public.trip_places
  for insert to authenticated with check (public.can_edit_trip_content(trip_id));

create policy trip_places_select on public.trip_places
  for select to authenticated using (public.has_trip_access(trip_id));

create policy trip_places_update on public.trip_places
  for update to authenticated
  using (public.can_edit_trip_content(trip_id))
  with check (public.can_edit_trip_content(trip_id));

create policy trips_delete on public.trips
  for delete to authenticated using (public.is_trip_owner(id));

create policy trips_insert on public.trips
  for insert to authenticated with check (user_id = auth.uid());

create policy trips_select on public.trips
  for select to authenticated using (public.has_trip_access(id));

create policy trips_update on public.trips
  for update to authenticated using (public.can_edit_trip_metadata(id));
