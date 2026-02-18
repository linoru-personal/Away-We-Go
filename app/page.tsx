"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trips, setTrips] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/dashboard");
      }
    };
    checkUser();
  }, [router]);

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
    router.push("/dashboard");
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
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-6">
      <div className="w-full max-w-[420px]">
        {/* Badge */}
        <div
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-white text-[#d97b5e] shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        {/* Card */}
        <div className="rounded-[28px] border border-[#ebe5df] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1f1f1f]">
            Away We Go
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6b6b6b]">
            Sign in to access your trips.
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-6 space-y-[16px]"
            noValidate
          >
            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-[#1f1f1f]"
              >
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
                className="mt-1.5 w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-60 aria-[invalid=true]:focus:ring-red-400/40 aria-[invalid=true]:focus:border-red-400"
              />
            </div>
            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-[#1f1f1f]"
              >
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
                className="mt-1.5 w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-60 aria-[invalid=true]:focus:ring-red-400/40 aria-[invalid=true]:focus:border-red-400"
              />
            </div>
            {error && (
              <p
                id="auth-error"
                className="text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="space-y-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#d97b5e] px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 focus:ring-offset-white active:bg-[#b85a42] disabled:opacity-60 disabled:hover:bg-[#d97b5e]"
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
                className="flex h-[50px] w-full items-center justify-center rounded-full border border-[#e0d9d2] bg-transparent px-4 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 focus:ring-offset-white active:bg-[#ebe5df] disabled:opacity-60"
              >
                Sign Up
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-[#8a8a8a]">
            Your data is securely stored in your account.
          </p>
        </div>
      </div>
    </main>
  );
}
