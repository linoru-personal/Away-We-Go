/**
 * Minimal server-side payload for rendering the trip invitation email.
 * All fields are derived from DB (trips, invitations), inviter context, and server config.
 *
 * Field sources (for buildInvitationEmailPayload):
 * - trips table       → tripName (title), destinationLabel (destination), tripDateLabel (start_date, end_date)
 * - trip_invitations / request → recipientEmail (email), role
 * - inviter context   → inviterName (profile display name or email), inviterEmail (auth)
 * - server config     → acceptUrl (NEXT_PUBLIC_APP_URL + /invite?token=...), coverImageUrl (signed URL from storage)
 */

export type InvitationEmailRole = "admin" | "editor" | "viewer";

export type TripInvitationEmailPayload = {
  inviterName: string;
  inviterEmail: string;
  recipientEmail: string;
  tripName: string;
  destinationLabel?: string;
  tripDateLabel?: string;
  role: InvitationEmailRole;
  acceptUrl: string;
  coverImageUrl?: string | null;
};

/** Trip row fields needed to build the payload (trips table). */
export type TripForInvitationEmail = {
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_path?: string | null;
};

/** Invitation/request context (trip_invitations.email + role, or request body after RPC). */
export type InvitationContextForEmail = {
  recipientEmail: string;
  role: InvitationEmailRole;
};

/** Authenticated inviter (from auth.users + profiles or fallback). */
export type InviterContextForEmail = {
  inviterEmail: string;
  inviterName: string;
};

/** Server-provided values (app URL + token → acceptUrl; optional signed cover URL). */
export type ServerContextForEmail = {
  acceptUrl: string;
  coverImageUrl?: string | null;
};

/**
 * Builds the invitation email payload from DB and server context.
 * Use after RPC returns invitation_created and you have trip + inviter data.
 *
 * Field sources:
 * - trips table: tripName (title), destinationLabel (destination), tripDateLabel (start_date, end_date)
 * - invitations / request: recipientEmail, role (use parseInvitationRole for request string)
 * - inviter context (auth + profile): inviterName, inviterEmail
 * - server config: acceptUrl (baseUrl + /invite?token=...), coverImageUrl (signed URL from trips.cover_image_path)
 *
 * @example
 * const payload = buildInvitationEmailPayload(
 *   trip,
 *   { recipientEmail: email, role: parseInvitationRole(role) },
 *   { inviterEmail: session.user.email, inviterName: profile?.username ?? session.user.email },
 *   { acceptUrl, coverImageUrl: signedCoverUrl }
 * );
 * const html = renderToStaticMarkup(<TripInvitationEmail {...payload} />);
 */
export function buildInvitationEmailPayload(
  trip: TripForInvitationEmail,
  invitation: InvitationContextForEmail,
  inviter: InviterContextForEmail,
  server: ServerContextForEmail
): TripInvitationEmailPayload {
  const tripDateLabel = formatTripDateLabel(trip.start_date, trip.end_date);
  return {
    inviterName: inviter.inviterName.trim() || inviter.inviterEmail,
    inviterEmail: inviter.inviterEmail,
    recipientEmail: invitation.recipientEmail.trim(),
    tripName: trip.title.trim() || "Trip",
    destinationLabel: trip.destination?.trim() || undefined,
    tripDateLabel: tripDateLabel || undefined,
    role: invitation.role,
    acceptUrl: server.acceptUrl,
    coverImageUrl: server.coverImageUrl ?? undefined,
  };
}

function formatTripDateLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  try {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
    }
    if (startDate) return startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (endDate) return endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return [start, end].filter(Boolean).join(" – ");
  }
  return "";
}

/** Validates and narrows role from string (e.g. request body). Defaults to "viewer" if invalid. */
export function parseInvitationRole(value: unknown): InvitationEmailRole {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (s === "admin" || s === "editor" || s === "viewer") return s;
  return "viewer";
}
