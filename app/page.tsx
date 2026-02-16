"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);

  const [trips, setTrips] = useState<any[]>([]); //
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

    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userData.user.id);

    if (error) {
      console.error(error);
    } else {
      setTrips(data || []);
    }
  };

  fetchTrips();
}, []);


  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push("/dashboard");
  };

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Away We Go</h1>

        <input
          className="w-full border rounded p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border rounded p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-2">
          <button className="bg-black text-white rounded px-4 py-2" onClick={handleLogin}>
            Login
          </button>
          <button className="border rounded px-4 py-2" onClick={handleSignup}>
            Sign Up
          </button>
        </div>
      </div>
    </main>
  );
}
