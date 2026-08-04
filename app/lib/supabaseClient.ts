'use client';

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Set while supabase-js processes the URL on client initialization, if that URL
 * was a password-recovery callback (`#access_token=...&type=recovery`).
 *
 * Why this exists: `/reset-password` must distinguish a session created by a
 * recovery link from an ordinary signed-in session. Without it, an already
 * signed-in user could set a new password without entering the current one,
 * bypassing the re-authentication that account settings requires.
 *
 * The `PASSWORD_RECOVERY` event can't be used for this — supabase-js fires it on
 * a `setTimeout(…, 0)` during initialization, which can land before React mounts
 * and subscribes. Reading `window.location.hash` on mount is equally unreliable,
 * because supabase-js clears the hash during initialization.
 */
let recoveryCallback = false;

/**
 * Whether this page load began as a password-recovery callback.
 *
 * Safe to read after any awaited `supabase.auth.getSession()`: that call starts
 * with `await initializePromise`, and the flag is set during initialization, so
 * it is guaranteed to be settled by then.
 */
export function wasRecoveryCallback(): boolean {
  return recoveryCallback;
}

export const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      detectSessionInUrl: (_url, params) => {
        if (params.type === "recovery") recoveryCallback = true;
        // The library's default predicate — behavior is otherwise unchanged.
        return Boolean(params.access_token || params.error_description);
      },
    },
  }
);

if (process.env.NODE_ENV === "development" && supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  console.log("Connected to Supabase URL:", supabaseUrl);
  console.log("Connected to Supabase project ref:", projectRef);
}
