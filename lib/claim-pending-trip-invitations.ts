import type { SupabaseClient } from "@supabase/supabase-js";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_TRIP_INVITES === "1";

/** Same-user debounce to avoid duplicate RPCs when multiple listeners fire (ms). */
const DEBOUNCE_MS = 2500;
let lastClaimKey = "";
let lastClaimAt = 0;

export type ClaimPendingInvitesResult = {
  ok: boolean;
  claimed: number;
  skipped?: boolean;
  skipReason?: string;
  message?: string;
  email_normalized?: string | null;
  trip_ids?: unknown;
  error?: string;
};

/**
 * Claims all pending `trip_invitations` rows whose `email_normalized` matches the
 * signed-in user's `auth.users` email. Upserts `trip_members` and marks invites accepted.
 * Safe to call after every sign-in; idempotent.
 */
export async function claimPendingTripInvitations(
  supabase: SupabaseClient,
  options?: { force?: boolean }
): Promise<ClaimPendingInvitesResult> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    if (DEBUG) {
      console.info("[trip-invites] claim skip: no user", userErr?.message);
    }
    return {
      ok: false,
      claimed: 0,
      skipped: true,
      skipReason: "no_user",
    };
  }

  const now = Date.now();
  const key = user.id;
  if (
    !options?.force &&
    lastClaimKey === key &&
    now - lastClaimAt < DEBOUNCE_MS
  ) {
    if (DEBUG) {
      console.info("[trip-invites] claim debounced", { uid: user.id });
    }
    return {
      ok: true,
      claimed: 0,
      skipped: true,
      skipReason: "debounced",
    };
  }
  lastClaimKey = key;
  lastClaimAt = now;

  const { data, error } = await supabase.rpc(
    "claim_pending_trip_invitations_for_user"
  );

  if (error) {
    console.warn("[trip-invites] claim RPC error", {
      message: error.message,
      code: error.code,
    });
    return {
      ok: false,
      claimed: 0,
      error: error.message,
    };
  }

  const row = data as {
    ok?: boolean;
    claimed?: number;
    trip_ids?: unknown;
    email_normalized?: string | null;
    message?: string;
  } | null;

  const claimed = typeof row?.claimed === "number" ? row.claimed : 0;

  if (DEBUG) {
    console.info("[trip-invites] claim RPC result", {
      ok: row?.ok,
      claimed,
      email_normalized: row?.email_normalized,
      message: row?.message,
      trip_ids: row?.trip_ids,
    });
  }

  return {
    ok: row?.ok !== false,
    claimed,
    email_normalized: row?.email_normalized,
    trip_ids: row?.trip_ids,
    message: row?.message,
  };
}
