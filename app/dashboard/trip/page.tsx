"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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

export default function TripPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("id");

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [debug, setDebug] = useState<string>("init");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setDebug(`start (tripId=${tripId ?? "null"})`);

      try {
        if (!tripId) {
          setError("Missing trip id in URL.");
          setTrip(null);
          setDebug("no tripId");
          return;
        }

        setDebug("calling auth.getUser()");
        const userRes = await supabase.auth.getUser();

        if (cancelled) return;

        const user = userRes.data.user;
        setDebug(`auth done (user=${user?.id ?? "null"})`);

        if (!user) {
          router.replace("/");
          return;
        }

        setDebug("fetching trip");
        const { data, error } = await supabase
          .from("trips")
          .select("*")
          .eq("id", tripId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setError(
            error?.message ?? "Trip not found (or you don't have access)."
          );
          setTrip(null);
          setDebug(`trip fetch failed (${error?.code ?? "no-code"})`);
          return;
        }

        setTrip(data as Trip);
        setTitle((data as Trip).title);
        setDebug("trip loaded ✅");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown error");
        setDebug("caught error in load()");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tripId, router]);

  function saveTitle() {
    if (!trip) return;

    const next = title.trim();
    if (!next) {
      setError("Title cannot be empty.");
      return;
    }

    setError(null);
    setSaved(false);

    startSaving(async () => {
      const { error } = await supabase
        .from("trips")
        .update({ title: next })
        .eq("id", trip.id);

      if (error) {
        setError(error.message);
        return;
      }

      setTrip((prev) => (prev ? { ...prev, title: next } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function deleteTrip() {
    if (!trip) return;

    const ok = confirm("Delete this trip? This cannot be undone.");
    if (!ok) return;

    setError(null);

    startDeleting(async () => {
      const { error } = await supabase.from("trips").delete().eq("id", trip.id);

      if (error) {
        setError(error.message);
        return;
      }

      router.replace("/dashboard");
    });
  }

  return (
    <main className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <button
          className="border rounded px-4 py-2"
          onClick={() => router.push("/dashboard")}
        >
          Back
        </button>

        {/* Debug line */}
        <div className="text-xs text-gray-500">
          debug: {debug} | urlId: {tripId ?? "—"}
        </div>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : !trip ? (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Trip</h1>
            <p className="text-gray-600">Trip id: {tripId ?? "—"}</p>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        ) : (
          <>
            <section className="border rounded p-4 space-y-2">
              <h1 className="text-3xl font-bold">{trip.title}</h1>

              <div className="text-gray-700 space-y-1">
                <div>
                  <span className="font-medium">Destination:</span>{" "}
                  {trip.destination ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Dates:</span>{" "}
                  {trip.start_date ?? "—"} → {trip.end_date ?? "—"}
                </div>
              </div>
            </section>

            <section className="border rounded p-4 space-y-3">
              <h2 className="text-xl font-semibold">Edit title</h2>

              <div className="flex gap-2">
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSaving || isDeleting}
                />
                <button
                  className="border rounded px-4 py-2"
                  onClick={saveTitle}
                  disabled={
                    isSaving || isDeleting || title.trim() === trip.title
                  }
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>

              {saved && <p className="text-green-700 text-sm">Saved ✅</p>}
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </section>

            <section className="border rounded p-4 space-y-3">
              <h2 className="text-xl font-semibold">Danger zone</h2>
              <button
                className="border rounded px-4 py-2"
                onClick={deleteTrip}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? "Deleting..." : "Delete trip"}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
