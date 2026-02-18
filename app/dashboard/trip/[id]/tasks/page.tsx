"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import TripHero from "@/components/trip/trip-hero";
import { TasksSection } from "@/components/tasks/tasks-section";

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

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? "—";
}

export default function ManageTasksPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripLoading, setTripLoading] = useState(true);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user || !id) {
      setTripLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setTrip(null);
        else setTrip(data as Trip);
        setTripLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (!id) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        {tripLoading ? (
          <p className="text-[#6B7280]">Loading…</p>
        ) : trip ? (
          <>
            <TripHero
              title={trip.title}
              dates={formatDates(trip.start_date, trip.end_date)}
              imageUrl={trip.cover_image_url ?? undefined}
              onBack={() => router.push(`/dashboard/trip/${id}`)}
            />
            <TasksSection tripId={id} />
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[#6B7280]">Trip not found.</p>
            <button
              type="button"
              className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950]"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
