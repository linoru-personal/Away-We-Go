-- Row-level triggers on public tables (functions must exist).

create or replace trigger editable_image_assets_updated_at
  before update on public.editable_image_assets
  for each row
  execute function public.set_editable_image_assets_updated_at();

create or replace trigger packing_items_trip_integrity_trigger
  before insert or update on public.packing_items
  for each row
  execute function public.packing_items_trip_integrity();

create or replace trigger trip_invitations_updated_at
  before update on public.trip_invitations
  for each row
  execute function public.set_updated_at();
