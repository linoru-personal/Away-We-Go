"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";

type AcceptResult = {
  success: boolean;
  status: string;
  trip_id: string | null;
  role: string | null;
};

type PageState =
  | "no_token"
  | "loading_session"
  | "need_auth"
  | "accepting"
  | "invalid"
  | "expired"
  | "revoked"
  | "email_mismatch"
  | "already_accepted_other"
  | "success"
  | "error";

export function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: sessionLoading } = useSession();

  const [state, setState] = useState<PageState>("loading_session");
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) {
      setState("loading_session");
      return;
    }

    if (!token?.trim()) {
      setState("no_token");
      return;
    }

    if (!user) {
      setState("need_auth");
      return;
    }

    let cancelled = false;

    (async () => {
      setState("accepting");
      const { data, error } = await supabase.rpc("accept_trip_invitation", {
        p_token: token.trim(),
      });

      if (cancelled) return;

      if (error) {
        setState("error");
        return;
      }

      const result = (data ?? {}) as AcceptResult;

      if (result.success) {
        setTripId(result.trip_id ?? null);
        setState("success");
        return;
      }

      switch (result.status) {
        case "invalid_token":
          setState("invalid");
          break;
        case "expired":
          setState("expired");
          break;
        case "revoked":
          setState("revoked");
          break;
        case "email_mismatch":
          setState("email_mismatch");
          break;
        case "already_accepted_other":
          setState("already_accepted_other");
          break;
        default:
          setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, sessionLoading]);

  const signInUrl = token?.trim()
    ? `/?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`
    : "/";

  const cardClass =
    "mx-auto w-full max-w-[420px] rounded-[28px] border border-[#ebe5df] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]";

  if (state === "loading_session" || state === "accepting") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <p className="text-center text-[#6b6b6b]">Loading…</p>
          <div className="mx-auto mt-4 size-8 animate-spin rounded-full border-2 border-[#d97b5e] border-t-transparent" />
        </div>
      </main>
    );
  }

  if (state === "no_token") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Invalid invite link</h1>
          <p className="mt-2 text-[#6b6b6b]">
            This link is missing the invitation token. Ask the trip owner to send a new invitation.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go home
          </Link>
        </div>
      </main>
    );
  }

  if (state === "need_auth") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Sign in to accept</h1>
          <p className="mt-2 text-[#6b6b6b]">
            Sign in or create an account with the email that received this invitation to accept it.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={signInUrl}
              className="flex h-[50px] items-center justify-center rounded-full bg-[#d97b5e] px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] hover:bg-[#c46950]"
            >
              Sign in
            </Link>
            <Link
              href={signInUrl}
              className="flex h-[50px] items-center justify-center rounded-full border border-[#e0d9d2] bg-transparent text-sm font-medium text-[#1f1f1f] hover:bg-[#f6f2ed]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state === "invalid" || state === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Invalid or expired link</h1>
          <p className="mt-2 text-[#6b6b6b]">
            This invitation link is invalid or has expired. Ask the trip owner for a new invitation.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "expired") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Invitation expired</h1>
          <p className="mt-2 text-[#6b6b6b]">
            This invitation has expired. Ask the trip owner to send a new one.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "revoked") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Invitation no longer valid</h1>
          <p className="mt-2 text-[#6b6b6b]">
            This invitation was revoked. Ask the trip owner if you still need access.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "email_mismatch") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Wrong account</h1>
          <p className="mt-2 text-[#6b6b6b]">
            Sign in with the email address that received this invitation to accept it.
          </p>
          <Link
            href={signInUrl}
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Sign in with different email
          </Link>
          <Link
            href="/dashboard"
            className="ml-3 mt-6 inline-block rounded-full border border-[#e0d9d2] px-4 py-2.5 text-sm font-medium text-[#1f1f1f] hover:bg-[#f6f2ed]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "already_accepted_other") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Already used</h1>
          <p className="mt-2 text-[#6b6b6b]">
            This invitation was already used by someone else. Ask the trip owner for a new invitation if you need access.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "success" && tripId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">You're in</h1>
          <p className="mt-2 text-[#6b6b6b]">
            You've accepted the invitation. You can open the trip from your dashboard.
          </p>
          <Link
            href={`/dashboard/trip/${tripId}`}
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] hover:bg-[#c46950]"
          >
            Open trip
          </Link>
          <Link
            href="/dashboard"
            className="ml-3 mt-6 inline-block rounded-full border border-[#e0d9d2] px-4 py-2.5 text-sm font-medium text-[#1f1f1f] hover:bg-[#f6f2ed]"
          >
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (state === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
        <div className={cardClass}>
          <h1 className="text-xl font-semibold text-[#1f1f1f]">Invitation accepted</h1>
          <p className="mt-2 text-[#6b6b6b]">You already had access. Head to your dashboard to find the trip.</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c46950]"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return null;
}
