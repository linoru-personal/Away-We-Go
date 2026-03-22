import type { SupabaseClient } from "@supabase/supabase-js";

const DEBUG_FLAG = process.env.NEXT_PUBLIC_DEBUG_TRIP_ACCESS === "1";

export type FetchTripResult<T> = {
  trip: T | null;
  /** True when PostgREST returned no row and no error (RLS filtered or missing id). */
  noRowVisible: boolean;
  /** Set when the request failed (network, etc.). */
  error: { message: string; code?: string; details?: string } | null;
};

/**
 * Load one trip row with RLS applied. Uses `.maybeSingle()` so 0 rows does not throw
 * PGRST116 / "Cannot coerce the result to a single JSON object".
 *
 * With RLS, "no row" is the same response whether the trip id does not exist or the
 * user is not owner and not in `trip_members`.
 *
 * Set `NEXT_PUBLIC_DEBUG_TRIP_ACCESS=1` to log `auth.uid()` and membership probe.
 */
export async function fetchTripByIdForUser<T extends object>(
  supabase: SupabaseClient,
  tripId: string,
  /** PostgREST select list; default `*`. */
  columns = "*"
): Promise<FetchTripResult<T>> {
  if (DEBUG_FLAG) {
    const { data: sessionData } = await supabase.auth.getSession();
    // eslint-disable-next-line no-console
    console.info("[trip-access] fetchTripByIdForUser", {
      tripId,
      authUid: sessionData.session?.user.id ?? null,
    });
  }

  const { data, error } = await supabase
    .from("trips")
    .select(columns)
    .eq("id", tripId)
    .maybeSingle();

  if (DEBUG_FLAG) {
    // eslint-disable-next-line no-console
    console.info("[trip-access] trips result", {
      tripId,
      hasRow: data != null,
      code: error?.code,
      message: error?.message,
      noRowVisible: !data && !error,
      note:
        !data && !error
          ? "0 rows: not visible under RLS or trip does not exist (same client response)"
          : undefined,
    });
  }

  if (error) {
    return { trip: null, noRowVisible: false, error };
  }

  if (!data) {
    if (DEBUG_FLAG) {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (uid) {
        const { data: memberRows, error: memErr } = await supabase
          .from("trip_members")
          .select("trip_id, user_id, role")
          .eq("trip_id", tripId)
          .eq("user_id", uid);
        // eslint-disable-next-line no-console
        console.info("[trip-access] trip_members self-row (RLS applies here too)", {
          tripId,
          authUid: uid,
          rowCount: memberRows?.length ?? 0,
          memberError: memErr?.message,
          rows: memberRows,
          hint:
            (memberRows?.length ?? 0) === 0
              ? "No membership row visible for this user — add trip_members row or accept invite with matching auth email"
              : "Membership row exists but trip still hidden — check has_trip_access / function owner / apply migration rls_helpers_row_security_off",
        });
      }
    }
    return { trip: null, noRowVisible: true, error: null };
  }

  return { trip: data as unknown as T, noRowVisible: false, error: null };
}
