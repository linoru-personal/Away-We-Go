'use client';

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

if (process.env.NODE_ENV === "development" && supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  console.log("Connected to Supabase URL:", supabaseUrl);
  console.log("Connected to Supabase project ref:", projectRef);
}
