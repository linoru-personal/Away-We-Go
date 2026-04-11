import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { TripInvitationEmail } from "@/components/emails/trip-invitation-email";
import {
  buildInvitationEmailPayload,
  parseInvitationRole,
  type TripForInvitationEmail,
} from "@/app/lib/invitation-email-payload";
import {
  parseShareTripWithInvitationRpc,
  type ShareTripWithInvitationRpcResult,
} from "@/lib/trip-invitations/parse-share-rpc";
import { getTripCoverDisplayUrl } from "@/lib/trip-media/resolve-cover";

/** Request body: server validates; authorization is done by RPC via caller's session. */
type InviteRequestBody = {
  trip_id: string;
  email: string;
  role?: string;
};

const LOG = "[trip-invitations]";

function logInvite(event: string, payload: Record<string, unknown>) {
  console.info(LOG, event, JSON.stringify(payload));
}

const INVITE_PATH = "/invite";

/**
 * Send invitation email via Resend. Uses pre-rendered HTML and subject.
 * In production, wire RESEND_API_KEY and RESEND_FROM.
 */
async function sendInvitationEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    const msg =
      "Email not configured. Set RESEND_API_KEY and RESEND_FROM in .env.local to send invitation emails.";
    if (process.env.NODE_ENV === "development") {
      console.warn(LOG, msg);
      return { ok: false, error: msg };
    }
    return { ok: false, error: "Email not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || res.statusText };
  }
  return { ok: true };
}

export type InvitePostSuccessBody = {
  success: true;
  outcome: "member_added" | "invitation_created";
  message: string;
  emailSent?: boolean;
};

export type InvitePostErrorBody = {
  success: false;
  message: string;
  outcome?: string;
  _debug?: string;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token?.trim()) {
      return NextResponse.json(
        { success: false, message: "Please sign in to send invitations." } satisfies InvitePostErrorBody,
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, message: "Server configuration error." } satisfies InvitePostErrorBody,
        { status: 500 }
      );
    }

    let body: InviteRequestBody;
    try {
      body = (await request.json()) as InviteRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request." } satisfies InvitePostErrorBody,
        { status: 400 }
      );
    }

    const tripId = typeof body.trip_id === "string" ? body.trip_id.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "viewer";
    const emailNormalized = email.toLowerCase();

    if (!tripId || !email) {
      return NextResponse.json(
        { success: false, message: "Trip and email are required." } satisfies InvitePostErrorBody,
        { status: 400 }
      );
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(tripId)) {
      return NextResponse.json(
        { success: false, message: "Invalid request." } satisfies InvitePostErrorBody,
        { status: 400 }
      );
    }

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    logInvite("rpc_attempt", {
      tripId,
      invitedEmail: email,
      emailNormalized,
      role,
    });

    const { data: rawRpc, error } = await supabase.rpc("share_trip_with_invitation", {
      p_trip_id: tripId,
      p_email: email,
      p_role: role,
    });

    if (error) {
      const errMsg =
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : String(error);
      const errCode = (error as { code?: string }).code;
      logInvite("rpc_error", {
        tripId,
        emailNormalized,
        code: errCode ?? null,
        message: errMsg,
      });
      process.stdout.write(`\n>>> TRIP-INV 502 RPC: ${errMsg} (code: ${errCode ?? "n/a"})\n\n`);
      const devMessage =
        process.env.NODE_ENV === "development" && errMsg
          ? errMsg
          : "Failed to grant access. Try again.";
      const errBody: InvitePostErrorBody = {
        success: false,
        message: devMessage,
      };
      if (process.env.NODE_ENV === "development") errBody._debug = `${errCode ?? ""}: ${errMsg}`;
      return NextResponse.json(errBody, { status: 502 });
    }

    const result: ShareTripWithInvitationRpcResult = parseShareTripWithInvitationRpc(rawRpc);

    logInvite("rpc_result", {
      tripId,
      emailNormalized,
      ok: result.ok,
      outcome: result.outcome ?? null,
      invitationId: result.invitation_id ?? null,
      emailSendRequired: result.email_send_required ?? null,
      hasToken: Boolean(result.invitation_token),
    });

    if (!result.ok) {
      logInvite("rpc_denied", {
        tripId,
        emailNormalized,
        message: result.message ?? null,
      });
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "Failed to grant access. Try again.",
        } satisfies InvitePostErrorBody,
        { status: 400 }
      );
    }

    /** Immediate membership — no invitation email. */
    if (result.outcome === "member_added") {
      logInvite("trip_members_upserted", {
        tripId,
        emailNormalized,
        outcome: "member_added",
      });
      return NextResponse.json({
        success: true,
        outcome: "member_added",
        message:
          "Access granted. They can open this trip from their dashboard now.",
        emailSent: false,
      } satisfies InvitePostSuccessBody);
    }

    if (result.email_send_required && result.invitation_token) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
        (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
      const acceptUrl = baseUrl
        ? `${baseUrl}${INVITE_PATH}?token=${encodeURIComponent(result.invitation_token)}`
        : "";

      if (!acceptUrl) {
        console.error(
          LOG,
          "Invitation created but NEXT_PUBLIC_APP_URL (or VERCEL_URL) not set."
        );
        return NextResponse.json(
          {
            success: false,
            message:
              "Failed to grant access — invitation was created but the invite link could not be built. Set NEXT_PUBLIC_APP_URL.",
          } satisfies InvitePostErrorBody,
          { status: 500 }
        );
      }

      const { data: tripRow } = await supabase
        .from("trips")
        .select("title, destination, start_date, end_date, cover_image_path, cover_image_url, media")
        .eq("id", tripId)
        .maybeSingle();

      const trip: TripForInvitationEmail = tripRow
        ? {
            title: tripRow.title ?? "",
            destination: tripRow.destination ?? null,
            start_date: tripRow.start_date ?? null,
            end_date: tripRow.end_date ?? null,
            cover_image_path: tripRow.cover_image_path ?? null,
          }
        : { title: "Trip", destination: null, start_date: null, end_date: null };

      const {
        data: { user: inviterUser },
      } = await supabase.auth.getUser();
      const inviterEmail = inviterUser?.email ?? "";
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", inviterUser?.id ?? "")
        .maybeSingle();
      const inviterName = profileRow?.username?.trim() || inviterEmail || "Someone";

      const coverImageUrl = tripRow
        ? await getTripCoverDisplayUrl(supabase, tripRow, "preview")
        : null;

      const payload = buildInvitationEmailPayload(
        trip,
        { recipientEmail: email, role: parseInvitationRole(role) },
        { inviterEmail, inviterName },
        { acceptUrl, coverImageUrl }
      );

      const subject = payload.tripName
        ? `You're invited to join "${payload.tripName}"`
        : "You're invited to join a trip";
      const { renderToStaticMarkup } = await import("react-dom/server");
      const html = renderToStaticMarkup(createElement(TripInvitationEmail, payload));

      logInvite("email_send_attempt", { tripId, emailNormalized, to: email });

      const sendResult = await sendInvitationEmail({
        to: email,
        subject,
        html,
      });

      if (!sendResult.ok) {
        const emailErr = sendResult.error ?? "unknown";
        logInvite("email_send_failed", {
          tripId,
          emailNormalized,
          error: emailErr,
        });
        process.stdout.write(`\n>>> TRIP-INV 502 EMAIL: ${String(emailErr)}\n\n`);
        const errBody: InvitePostErrorBody = {
          success: false,
          outcome: "invitation_created",
          message:
            "Failed to grant access — the invitation was saved but the email did not send. Try again, or ask the invitee to check spam. They must open the invite link while signed in with the invited email.",
        };
        if (process.env.NODE_ENV === "development") errBody._debug = String(emailErr);
        return NextResponse.json(errBody, { status: 502 });
      }

      logInvite("email_send_ok", { tripId, emailNormalized });

      return NextResponse.json({
        success: true,
        outcome: "invitation_created",
        message:
          "Invitation sent. They’ll get access after they sign up or sign in and accept the invite link.",
        emailSent: true,
      } satisfies InvitePostSuccessBody);
    }

    logInvite("unexpected_rpc_shape", {
      tripId,
      emailNormalized,
      result: JSON.stringify(result),
    });
    return NextResponse.json(
      {
        success: false,
        message: "Failed to grant access — unexpected server response. Try again.",
      } satisfies InvitePostErrorBody,
      { status: 500 }
    );
  } catch (e) {
    const errStr = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${LOG} 500 CATCH — ${errStr}\n`);
    console.error(LOG, "500 CATCH:", e);
    const errBody: InvitePostErrorBody = {
      success: false,
      message: "Something went wrong. Try again.",
    };
    if (process.env.NODE_ENV === "development") errBody._debug = errStr;
    return NextResponse.json(errBody, { status: 500 });
  }
}
