"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, wasRecoveryCallback } from "@/app/lib/supabaseClient";
import { claimPendingTripInvitations } from "@/lib/claim-pending-trip-invitations";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/auth/auth-form-styles";

/** Matches the minimum enforced by the account settings password tab. */
const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "ready" | "invalid";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M6.6 6.6A18.6 18.6 0 0 0 2 11s3.6 7 10 7a9.1 9.1 0 0 0 3.5-.66" />
          <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      )}
    </svg>
  );
}

export function ResetPasswordContent() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Best-effort: if supabase-js hasn't cleared the hash yet, its error text is
    // more specific than our generic copy. The gate below never depends on it.
    const hashError = (() => {
      if (typeof window === "undefined") return null;
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return null;
      const params = new URLSearchParams(hash);
      const description = params.get("error_description");
      return description ? description.replace(/\+/g, " ") : null;
    })();

    const check = async () => {
      // getSession() begins with `await initializePromise`, so by the time this
      // resolves supabase-js has consumed any recovery hash and set the flag.
      // No race, and no need to subscribe to PASSWORD_RECOVERY.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      // Both conditions matter. A session alone would also admit an already
      // signed-in user, who must instead go through account settings and supply
      // their current password.
      if (data.session && wasRecoveryCallback()) {
        setStatus("ready");
        return;
      }

      setInvalidReason(hashError);
      setStatus("invalid");
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Minimum ${MIN_PASSWORD_LENGTH} characters for new password.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setSaving(false);
      // A dead session can't be recovered by retyping, so send them back to
      // request a fresh link instead of leaving a form that can never succeed.
      const message = err.message.toLowerCase();
      if (
        message.includes("session") ||
        message.includes("expired") ||
        message.includes("jwt")
      ) {
        setInvalidReason(err.message);
        setStatus("invalid");
        return;
      }
      setError(err.message);
      return;
    }

    // Mirrors login and signup: a user resetting their password may have
    // arrived from a trip invite.
    await claimPendingTripInvitations(supabase, { force: true });
    router.push("/dashboard");
  };

  if (status === "checking") {
    return (
      <AuthShell srHeading="Set a new password">
        <div className="flex flex-col items-center gap-4 py-6">
          <span
            className="size-8 animate-spin rounded-full border-2 border-[#d97b5e] border-t-transparent"
            aria-hidden
          />
          <p className="text-center text-[#6b6b6b]">Verifying your link…</p>
        </div>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell srHeading="Reset link is invalid">
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#1f1f1f]">
              This link is invalid or has expired
            </h2>
            <p className="text-sm leading-relaxed text-[#6b6b6b]">
              {invalidReason
                ? invalidReason
                : "Password reset links can only be used once, and they expire shortly after being sent. Request a new one to continue."}
            </p>
          </div>
          <Link
            href="/forgot-password"
            className={`${PRIMARY_BUTTON_CLASS} no-underline`}
          >
            Request a new link
          </Link>
          <p className="text-center">
            <Link href="/" className={TEXT_LINK_CLASS}>
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      srHeading="Set a new password"
      subtitle="Choose a new password for your account."
    >
      <form onSubmit={handleSubmit} className="space-y-[16px]" noValidate>
        <div>
          <label htmlFor="reset-password" className={LABEL_CLASS}>
            New password
          </label>
          <div className="relative mt-1.5">
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              disabled={saving}
              aria-invalid={!!error}
              aria-describedby="reset-hint"
              className={`${INPUT_CLASS} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#8a8a8a] transition hover:text-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <p id="reset-hint" className="mt-1 text-xs text-[#8a8a8a]">
            Minimum {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>

        <div>
          <label htmlFor="reset-confirm-password" className={LABEL_CLASS}>
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(null);
            }}
            disabled={saving}
            aria-invalid={!!error}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving}
            className={PRIMARY_BUTTON_CLASS}
          >
            {saving ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Updating…
              </>
            ) : (
              "Set new password"
            )}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
