-- Foreign keys (after all referenced tables exist).

alter table public.editable_image_assets
  add constraint editable_image_assets_participant_id_fkey
  foreign key (participant_id) references public.trip_participants (id) on delete cascade;

alter table public.editable_image_assets
  add constraint editable_image_assets_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.editable_image_assets
  add constraint fk_editable_image_assets_avatar_trip
  foreign key (trip_id, participant_id) references public.trip_participants (trip_id, id);

comment on constraint fk_editable_image_assets_avatar_trip on public.editable_image_assets is
  'For participant_avatar: ensures the participant belongs to this trip. No effect when participant_id is null.';

alter table public.packing_categories
  add constraint packing_categories_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.packing_items
  add constraint packing_items_assigned_to_participant_id_fkey
  foreign key (assigned_to_participant_id) references public.trip_participants (id) on delete set null;

alter table public.packing_items
  add constraint packing_items_category_id_fkey
  foreign key (category_id) references public.packing_categories (id) on delete restrict;

alter table public.packing_items
  add constraint packing_items_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.packing_items
  add constraint packing_items_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

alter table public.tasks
  add constraint tasks_trip_id_fkey foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_budget_categories
  add constraint trip_budget_categories_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_budget_items
  add constraint trip_budget_items_category_id_fkey
  foreign key (category_id) references public.trip_budget_categories (id) on delete set null;

alter table public.trip_budget_items
  add constraint trip_budget_items_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_currencies
  add constraint trip_currencies_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_exchange_rates
  add constraint trip_exchange_rates_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_invitations
  add constraint trip_invitations_accepted_by_user_id_fkey
  foreign key (accepted_by_user_id) references auth.users (id) on delete set null;

alter table public.trip_invitations
  add constraint trip_invitations_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete restrict;

alter table public.trip_invitations
  add constraint trip_invitations_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_members
  add constraint trip_members_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_members
  add constraint trip_members_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.trip_notes
  add constraint trip_notes_trip_id_fkey foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_participants
  add constraint trip_participants_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_photos
  add constraint trip_photos_added_by_user_id_fkey
  foreign key (added_by_user_id) references auth.users (id) on delete cascade;

alter table public.trip_photos
  add constraint trip_photos_trip_id_fkey foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_place_categories
  add constraint trip_place_categories_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete cascade;

alter table public.trip_places
  add constraint trip_places_added_by_user_id_fkey
  foreign key (added_by_user_id) references auth.users (id) on delete cascade;

alter table public.trip_places
  add constraint trip_places_category_id_fkey
  foreign key (category_id) references public.trip_place_categories (id) on delete set null;

alter table public.trip_places
  add constraint trip_places_trip_id_fkey foreign key (trip_id) references public.trips (id) on delete cascade;
