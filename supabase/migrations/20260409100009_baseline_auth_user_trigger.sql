-- Not present in schema.sql dump: wire new auth users to public.profiles.
-- Requires privileges to create triggers on auth.users (Supabase migration / service role).

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
