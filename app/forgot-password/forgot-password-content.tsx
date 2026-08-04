"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/auth/auth-form-styles";

/** Seconds before the reset email can be requested again. */
const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordContent() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Keep the latest submitted address available to the resend button without
  // making it depend on the (now hidden) input's state.
  const lastRequested = useRef("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendResetEmail = async (address: string) => {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (err) {
      // Supabase's rate limiter returns the retry window in its message
      // ("you can only request this after N seconds") — show it as-is so the
      // user learns the actual wait rather than a vague failure.
      setError(err.message);
      return;
    }

    lastRequested.current = address;
    setSentTo(address);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setError("Please enter your email address.");
      return;
    }
    await sendResetEmail(address);
  };

  const handleResend = async () => {
    if (cooldown > 0 || !lastRequested.current) return;
    await sendResetEmail(lastRequested.current);
  };

  if (sentTo) {
    return (
      <AuthShell
        srHeading="Check your email"
        subtitle="Check your email for a reset link."
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#1f1f1f]">
              Check your email
            </h2>
            {/* Deliberately neutral: Supabase returns success for addresses that
                have no account, and saying so here would leak which emails are
                registered. */}
            <p className="text-sm leading-relaxed text-[#6b6b6b]">
              If an account exists for{" "}
              <span className="font-medium text-[#1f1f1f]">{sentTo}</span>, we
              &apos;ve sent a link to reset your password. The link expires
              shortly, so use it soon.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              className={SECONDARY_BUTTON_CLASS}
            >
              {loading
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend email"}
            </button>
            <Link
              href="/"
              className={`${PRIMARY_BUTTON_CLASS} no-underline`}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      srHeading="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="space-y-[16px]" noValidate>
        <div>
          <label htmlFor="forgot-email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "forgot-error" : undefined}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </div>

        {error && (
          <p id="forgot-error" className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className={PRIMARY_BUTTON_CLASS}
          >
            {loading ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center">
        <Link href="/" className={TEXT_LINK_CLASS}>
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
