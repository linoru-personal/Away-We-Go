-- Privileges (matches schema.sql grants + default privileges for future objects).

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on function public.accept_trip_invitation(text) to anon, authenticated, service_role;
grant all on function public.can_edit_trip_content(uuid) to anon, authenticated, service_role;
grant all on function public.can_edit_trip_metadata(uuid) to anon, authenticated, service_role;
grant all on function public.can_manage_trip_sharing(uuid) to anon, authenticated, service_role;
grant all on function public.check_username_available(text) to anon, authenticated, service_role;
grant all on function public.claim_pending_trip_invitations_for_user() to anon, authenticated, service_role;
grant all on function public.ensure_default_packing_categories(uuid) to anon, authenticated, service_role;
grant all on function public.get_trip_members(uuid) to anon, authenticated, service_role;
grant all on function public.handle_new_user() to anon, authenticated, service_role;
grant all on function public.has_trip_access(uuid) to anon, authenticated, service_role;
grant all on function public.is_trip_owner(uuid) to anon, authenticated, service_role;
grant all on function public.packing_items_trip_integrity() to anon, authenticated, service_role;
grant all on function public.set_editable_image_assets_updated_at() to anon, authenticated, service_role;
grant all on function public.set_updated_at() to anon, authenticated, service_role;
grant all on function public.share_trip(uuid, text) to anon, authenticated, service_role;
grant all on function public.share_trip(uuid, text, text) to anon, authenticated, service_role;
grant all on function public.share_trip_with_invitation(uuid, text, text) to anon, authenticated, service_role;
grant all on function public.unshare_trip(uuid, uuid) to anon, authenticated, service_role;

grant all on table public.editable_image_assets to anon, authenticated, service_role;
grant all on table public.packing_categories to anon, authenticated, service_role;
grant all on table public.packing_items to anon, authenticated, service_role;
grant all on table public.profiles to anon, authenticated, service_role;
grant all on table public.tasks to anon, authenticated, service_role;
grant all on table public.trip_budget_categories to anon, authenticated, service_role;
grant all on table public.trip_budget_items to anon, authenticated, service_role;
grant all on table public.trip_currencies to anon, authenticated, service_role;
grant all on table public.trip_exchange_rates to anon, authenticated, service_role;
grant all on table public.trip_invitations to anon, authenticated, service_role;
grant all on table public.trip_members to anon, authenticated, service_role;
grant all on table public.trip_notes to anon, authenticated, service_role;
grant all on table public.trip_participants to anon, authenticated, service_role;
grant all on table public.trip_photos to anon, authenticated, service_role;
grant all on table public.trip_place_categories to anon, authenticated, service_role;
grant all on table public.trip_places to anon, authenticated, service_role;
grant all on table public.trips to anon, authenticated, service_role;

alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
