"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../lib/useSession";
import { TripCard } from "@/components/trips/trip-card";
import CreateFirstTripCard from "@/components/trips/create-first-trip-card";
import TripFormModal from "@/components/trips/trip-form-modal";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  created_at: string | null;
};

function getGreetingName(user: { email?: string | null; user_metadata?: { full_name?: string } }): string {
  const name = user?.user_metadata?.full_name ?? user?.email?.split("@")[0];
  return name && name.length > 0 ? name : "there";
}

function getEmptyMessage(tab: "all" | "upcoming" | "past"): string {
  switch (tab) {
    case "past":
      return "No past trips yet.";
    case "upcoming":
      return "No upcoming trips.";
    default:
      return "No trips yet.";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [coverSignedUrls, setCoverSignedUrls] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "past">("upcoming");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoadingTrips(true);
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false });

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
  }, [user]);

  useEffect(() => {
    const withPath = trips.filter((t) => t.cover_image_path);
    if (withPath.length === 0) {
      setCoverSignedUrls({});
      return;
    }
    Promise.all(
      withPath.map(async (t) => {
        const { data, error } = await supabase.storage
          .from("trip-covers")
          .createSignedUrl(t.cover_image_path!, 3600);
        if (error || !data?.signedUrl) return { id: t.id, url: null };
        return { id: t.id, url: data.signedUrl };
      })
    ).then((results) => {
      const next: Record<string, string> = {};
      results.forEach((r) => {
        if (r.url) next[r.id] = r.url;
      });
      setCoverSignedUrls(next);
    });
  }, [trips]);

  const today = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  const filteredTrips = useMemo(() => {
    if (activeTab === "all") return trips;
    if (activeTab === "upcoming") {
      return trips.filter((t) => t.end_date == null || t.end_date >= today);
    }
    return trips.filter((t) => t.end_date != null && t.end_date < today);
  }, [trips, activeTab, today]);

  const hasAnyTrips = trips.length > 0;

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const refetchTrips = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTrips(data as Trip[]);
  };

  if (sessionLoading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-gray-600">
        Loading...
      </p>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = getGreetingName(user);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header: greeting + logout */}
        <div className="relative mb-8">
          <div className="pr-24">
            <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
              Good morning, {displayName}
            </h1>
            <p className="mt-1 text-neutral-600">
              Where would you like to go next?
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="absolute top-0 right-0 rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
          >
            Logout
          </button>
        </div>

        {/* Segmented control: All, Upcoming, Past */}
        <div className="mb-8 flex gap-1 rounded-full bg-neutral-200 p-1 w-fit">
          {(["all", "upcoming", "past"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab === "all" ? "All" : tab === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>

        {/* 1) Your Trips section (top) */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-neutral-900">
            Your Trips
          </h2>

          {loadingTrips ? (
            <p className="text-neutral-600">Loading trips...</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {hasAnyTrips && (
                <CreateFirstTripCard
                  variant="small"
                  titleText="Create New Trip"
                  onClick={() => setIsCreateOpen(true)}
                />
              )}
              {filteredTrips.map((t) => (
                <TripCard
                  key={t.id}
                  title={t.title}
                  startDate={t.start_date ?? "—"}
                  endDate={t.end_date ?? "—"}
                  coverImageUrl={coverSignedUrls[t.id] ?? t.cover_image_url ?? undefined}
                  onClick={() => router.push(`/dashboard/trip/${t.id}`)}
                />
              ))}
            </div>
          )}

          {!loadingTrips && filteredTrips.length === 0 && (
            <p className="text-neutral-500">
              {hasAnyTrips
                ? getEmptyMessage(activeTab)
                : "No trips yet. Create your first one below."}
            </p>
          )}
        </section>

        {/* 2) Large create card (only when user has no trips) */}
        {!loadingTrips && !hasAnyTrips && (
          <section className="mb-10 flex justify-center">
            <div className="w-full max-w-md">
              <CreateFirstTripCard
                variant="large"
                titleText="Create Your First Trip"
                onClick={() => setIsCreateOpen(true)}
              />
            </div>
          </section>
        )}

        {/* 3) Sample Trip section (bottom) */}
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Sample Trip
          </p>
          <TripCard
            title="Reykjavik, Iceland"
            startDate="Apr 10"
            endDate="Apr 17"
            onClick={() => {}}
          />
          <div className="flex -space-x-2">
            <div className="size-8 rounded-full border-2 border-white bg-neutral-300" />
            <div className="size-8 rounded-full border-2 border-white bg-neutral-400" />
            <div className="size-8 rounded-full border-2 border-white bg-neutral-500" />
          </div>
        </section>

        <TripFormModal
          mode="create"
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={refetchTrips}
        />
      </div>
    </main>
  );
}
