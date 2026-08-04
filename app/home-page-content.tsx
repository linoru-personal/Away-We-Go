"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { claimPendingTripInvitations } from "@/lib/claim-pending-trip-invitations";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/auth/auth-form-styles";

/** Safe redirect: only allow relative path starting with / (e.g. /invite?token=...) */
function getSafeRedirect(redirect: string | null): string | null {
  if (!redirect || typeof redirect !== "string") return null;
  const s = redirect.trim();
  if (s === "" || !s.startsWith("/") || s.startsWith("//")) return null;
  return s;
}

export function HomePageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trips, setTrips] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await claimPendingTripInvitations(supabase, { force: true });
        router.push(redirectTo ?? "/dashboard");
      }
    };
    checkUser();
  }, [router, redirectTo]);

  useEffect(() => {
    const fetchTrips = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.from("trips").select("*");
      if (error) console.error(error);
      else setTrips(data || []);
    };
    fetchTrips();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    await claimPendingTripInvitations(supabase, { force: true });
    router.push(redirectTo ?? "/dashboard");
  };

  const handleSignup = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    await claimPendingTripInvitations(supabase, { force: true });
    router.push(redirectTo ?? "/dashboard");
  };

  return (
    <AuthShell
      srHeading="Sign in to Away We Go"
      subtitle="Sign in to access your trips."
      footer="Your data is securely stored in your account."
    >
      <form onSubmit={handleLogin} className="mt-6 space-y-[16px]" noValidate>
        <div>
          <label htmlFor="auth-email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "auth-error" : undefined}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </div>
        <div>
          <label htmlFor="auth-password" className={LABEL_CLASS}>
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            disabled={loading}
            aria-invalid={!!error}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
          <p className="mt-2 text-right">
            <Link href="/forgot-password" className={TEXT_LINK_CLASS}>
              Forgot password?
            </Link>
          </p>
        </div>
        {error && (
          <p id="auth-error" className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="space-y-3 pt-1">
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
                Please wait…
              </>
            ) : (
              "Login"
            )}
          </button>
          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            className={SECONDARY_BUTTON_CLASS}
          >
            Sign Up
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
