import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Use in Server Components, Route Handlers, and Server Actions.
 * Do not import this file from client components.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
