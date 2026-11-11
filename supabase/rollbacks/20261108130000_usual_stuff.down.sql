-- Rollback for 20261108130000_usual_stuff.sql
-- Drops only objects created by that migration. Nothing existing is touched.
-- Warning: this deletes all usual stuff data.

drop function if exists public.seed_trip_categories_from_usual(uuid);
drop function if exists public.add_usual_items_to_trip(uuid, jsonb);
drop function if exists public.add_to_my_usual_stuff(jsonb);
drop function if exists public.delete_usual_category(uuid, uuid);
drop function if exists public.reorder_usual_categories(uuid[]);
drop function if exists public.reorder_usual_items(uuid, uuid[]);
drop function if exists public.get_or_create_my_usual_list();

-- Dropping the tables also drops their indexes and policies.
drop table if exists public.usual_items;
drop table if exists public.usual_categories;
drop table if exists public.usual_lists;

drop function if exists public.usual_list_owned_by_user(uuid);
