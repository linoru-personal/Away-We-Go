/** Shape returned by `share_trip_with_invitation` (jsonb). */
export type ShareTripWithInvitationRpcResult = {
  ok: boolean;
  message?: string;
  outcome?: "member_added" | "invitation_created";
  invitation_id?: string | null;
  invitation_token?: string | null;
  email_send_required?: boolean;
};

/**
 * PostgREST may return jsonb RPC payloads as a parsed object or (rarely) a JSON string.
 */
export function parseShareTripWithInvitationRpc(
  data: unknown
): ShareTripWithInvitationRpcResult {
  if (data == null) {
    return { ok: false, message: "Empty response from database" };
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === "object" && "ok" in (parsed as object)) {
        return parsed as ShareTripWithInvitationRpcResult;
      }
      return { ok: false, message: "Invalid JSON in RPC response" };
    } catch {
      return { ok: false, message: "Could not parse RPC response" };
    }
  }
  if (typeof data === "object" && data !== null && "ok" in data) {
    return data as ShareTripWithInvitationRpcResult;
  }
  return { ok: false, message: "Unexpected RPC response shape" };
}
