import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { TripInvitationEmail } from "@/components/emails/trip-invitation-email";
import {
  buildInvitationEmailPayload,
  parseInvitationRole,
  type TripForInvitationEmail,
} from "@/app/lib/invitation-email-payload";

/** RPC result from share_trip_with_invitation */
type ShareTripResult = {
  ok: boolean;
  message?: string;
  outcome?: "member_added" | "invitation_created";
  invitation_id?: string | null;
  invitation_token?: string | null;
  email_send_required?: boolean;
};

/** Request body: server validates; authorization is done by RPC via caller's session. */
type InviteRequestBody = {
  trip_id: string;
  email: string;
  role?: string;
};

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
      console.warn("[trip-invitations]", msg);
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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token?.trim()) {
      return NextResponse.json(
        { success: false, message: "Please sign in to send invitations." },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, message: "Server configuration error." },
        { status: 500 }
      );
    }

    let body: InviteRequestBody;
    try {
      body = (await request.json()) as InviteRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request." },
        { status: 400 }
      );
    }

    const tripId = typeof body.trip_id === "string" ? body.trip_id.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "viewer";

    if (!tripId || !email) {
      return NextResponse.json(
        { success: false, message: "Trip and email are required." },
        { status: 400 }
      );
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(tripId)) {
      return NextResponse.json(
        { success: false, message: "Invalid request." },
        { status: 400 }
      );
    }

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.rpc("share_trip_with_invitation", {
      p_trip_id: tripId,
      p_email: email,
      p_role: role,
    });

    if (error) {
      const errMsg = typeof (error as { message?: string }).message === "string" ? (error as { message: string }).message : String(error);
      const errCode = (error as { code?: string }).code;
      // Unmissable: stdout so it appears next to Next.js request log; response body has _debug in dev
      process.stdout.write(`\n>>> TRIP-INV 502 RPC: ${errMsg} (code: ${errCode ?? "n/a"})\n\n`);
      const devMessage =
        process.env.NODE_ENV === "development" && errMsg
          ? errMsg
          : "Unable to process invitation. Try again.";
      const body: { success: false; message: string; _debug?: string } = {
        success: false,
        message: devMessage,
      };
      if (process.env.NODE_ENV === "development") body._debug = `${errCode ?? ""}: ${errMsg}`;
      return NextResponse.json(body, { status: 502 });
    }

    const result = (data ?? {}) as ShareTripResult;
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message ?? "Unable to process invitation. Try again." },
        { status: 400 }
      );
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
        console.error("[trip-invitations] Invitation created but NEXT_PUBLIC_APP_URL (or VERCEL_URL) not set.");
        return NextResponse.json(
          { success: false, message: "Invitation was created but the invite link could not be built. Contact support." },
          { status: 500 }
        );
      }

      const { data: tripRow } = await supabase
        .from("trips")
        .select("title, destination, start_date, end_date, cover_image_path")
        .eq("id", tripId)
        .single();

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

      let coverImageUrl: string | null = null;
      if (trip.cover_image_path) {
        const { data: signed } = await supabase.storage
          .from("trip-covers")
          .createSignedUrl(trip.cover_image_path, 3600);
        if (signed?.signedUrl) coverImageUrl = signed.signedUrl;
      }

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

      const sendResult = await sendInvitationEmail({
        to: email,
        subject,
        html,
      });
      if (!sendResult.ok) {
        const emailErr = sendResult.error ?? "unknown";
        process.stdout.write(`\n>>> TRIP-INV 502 EMAIL: ${String(emailErr)}\n\n`);
        const body: { success: false; message: string; _debug?: string } = {
          success: false,
          message: "Invitation was created but we couldn't send the email. Try again later.",
        };
        if (process.env.NODE_ENV === "development") body._debug = String(emailErr);
        return NextResponse.json(body, { status: 502 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "If that person has an account, they've been added. Otherwise, an invitation was sent.",
    });
  } catch (e) {
    const errStr = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[trip-invitations] 500 CATCH — ${errStr}\n`);
    console.error("[trip-invitations] 500 CATCH:", e);
    const body: { success: false; message: string; _debug?: string } = {
      success: false,
      message: "Something went wrong. Try again.",
    };
    if (process.env.NODE_ENV === "development") body._debug = errStr;
    return NextResponse.json(body, { status: 500 });
  }
}
