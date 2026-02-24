"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../lib/useSession";
import { useProfile, getDisplayName } from "../lib/useProfile";
import type { User } from "@supabase/supabase-js";
import { TripCard } from "@/components/trips/trip-card";
import CreateFirstTripCard from "@/components/trips/create-first-trip-card";
import TripFormModal from "@/components/trips/trip-form-modal";
import AccountSettingsModal from "@/components/account/account-settings-modal";

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

/**
 * DashboardPage: useSession + redirect logic + early returns only.
 * No useProfile here; it runs inside DashboardInner when user exists.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
    }
  }, [sessionLoading, user, router]);

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
  return <DashboardInner user={user} />;
}

/**
 * DashboardInner: all trip UI and state. Only mounted when user exists.
 * useProfile(user) runs here so it's only executed when user exists.
 */
function DashboardInner({ user }: { user: User }) {
  const router = useRouter();
  const { profile, refetch: refetchProfile } = useProfile(user);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [coverSignedUrls, setCoverSignedUrls] = useState<Record<string, string>>({});
  const [tripParticipantAvatars, setTripParticipantAvatars] = useState<
    Record<string, (string | null)[]>
  >({});
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "past">("upcoming");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    if (trips.length === 0) {
      setTripParticipantAvatars({});
      return;
    }
    const tripIds = trips.map((t) => t.id);
    (async () => {
      const { data: rows, error } = await supabase
        .from("trip_participants")
        .select("trip_id, avatar_path, sort_order")
        .in("trip_id", tripIds)
        .order("sort_order", { ascending: true });
      if (error) {
        setTripParticipantAvatars({});
        return;
      }
      const list = (rows ?? []) as {
        trip_id: string;
        avatar_path: string | null;
        sort_order: number;
      }[];
      const map: Record<string, (string | null)[]> = {};
      for (const t of trips) map[t.id] = [];
      for (const row of list) {
        if (!row.avatar_path) {
          map[row.trip_id].push(null);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(row.avatar_path, 3600);
        map[row.trip_id].push(signed?.signedUrl ?? null);
      }
      setTripParticipantAvatars(map);
    })();
  }, [trips]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const filteredTrips = useMemo(() => {
    if (activeTab === "all") return trips;
    if (activeTab === "upcoming") {
      return trips.filter((t) => t.end_date == null || t.end_date >= today);
    }
    return trips.filter((t) => t.end_date != null && t.end_date < today);
  }, [trips, activeTab, today]);

  const hasAnyTrips = trips.length > 0;
  const displayName = getDisplayName(user, profile);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const refetchTrips = async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTrips(data as Trip[]);
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header: greeting + profile icon + logout */}
        <div className="relative mb-8">
          <div className="pr-24">
            <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
              Good morning, {displayName}
            </h1>
            <p className="mt-1 text-neutral-600">
              Where would you like to go next?
            </p>
          </div>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAccountOpen(true)}
              className="flex size-10 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2"
              aria-label="Account settings"
              title="Update profile"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
            >
              Logout
            </button>
          </div>
        </div>

        <AccountSettingsModal
          open={isAccountOpen}
          onOpenChange={setIsAccountOpen}
          user={user}
          profile={profile ?? null}
          onProfileUpdated={refetchProfile}
          onLogout={logout}
        />

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
                  participantAvatarUrls={tripParticipantAvatars[t.id] ?? []}
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
