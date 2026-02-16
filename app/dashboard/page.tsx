"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { TripCard } from "@/components/trips/trip-card";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  // Create form
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(""); // YYYY-MM-DD

  // 1) load user + trips
  useEffect(() => {
    const load = async () => {
      setLoadingTrips(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;

      if (!user) {
        router.replace("/");
        return;
      }

      setEmail(user.email ?? null);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false }); // אפשר להסתמך על RLS

      if (error) {
        console.error(error);
        alert(error.message);
        setLoadingTrips(false);
        return;
      }

      setTrips((data ?? []) as Trip[]);
      setLoadingTrips(false);
    };

    load();
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const createTrip = async () => {
    if (!userId) return;

    const trimmedTitle = title.trim();
    const trimmedDestination = destination.trim();

    if (!trimmedTitle) {
      alert("Please enter a title");
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      alert("End date must be on/after start date");
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId, // נשאיר כמו אצלך כרגע
        title: trimmedTitle,
        destination: trimmedDestination || null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setTrips((prev) => [data as Trip, ...prev]);

    // reset form
    setTitle("");
    setDestination("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600">
              Logged in as: <span className="font-medium">{email ?? "—"}</span>
            </p>
          </div>

          <button className="border rounded px-4 py-2" onClick={logout}>
            Logout
          </button>
        </div>

        {/* Create Trip */}
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-xl font-semibold">Create Trip</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="border rounded px-3 py-2"
              placeholder="Trip title (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Destination (optional)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button
            className="bg-black text-white rounded px-4 py-2"
            onClick={createTrip}
          >
            Add Trip
          </button>
        </section>

        {/* Trips list */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your Trips</h2>

          {loadingTrips ? (
            <p className="text-gray-600">Loading trips...</p>
          ) : trips.length === 0 ? (
            <p className="text-gray-600">No trips yet. Create your first one 👆</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((t) => (
                <TripCard
                  key={t.id}
                  title={t.title}
                  startDate={t.start_date ?? "—"}
                  endDate={t.end_date ?? "—"}
                  coverImageUrl={t.cover_image_url ?? undefined}
                  onClick={() => router.push(`/dashboard/trip?id=${t.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
