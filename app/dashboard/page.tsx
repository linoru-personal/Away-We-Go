"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../lib/useSession";
import { useProfile, getDisplayName } from "../lib/useProfile";
import { useDashboardTrips } from "@/components/dashboard/dashboard-trips-context";
import type { User } from "@supabase/supabase-js";
import { TripCard } from "@/components/trips/trip-card";
import { DASHBOARD_LIST_PAGE_SHELL } from "@/components/trip/dashboard-card-styles";
import CreateFirstTripCard from "@/components/trips/create-first-trip-card";
import TripFormModal from "@/components/trips/trip-form-modal";
import AccountSettingsModal from "@/components/account/account-settings-modal";
import type { DashboardTrip } from "@/components/dashboard/dashboard-trips-context";

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

function getTimeBasedGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
    }
  }, [sessionLoading, user, router]);

  if (sessionLoading || !user) {
    return null;
  }
  return <DashboardInner user={user} />;
}

function DashboardInner({ user }: { user: User }) {
  const router = useRouter();
  const { profile, refetch: refetchProfile } = useProfile(user);
  const {
    trips,
    loadingTrips,
    refetchTrips,
    coverSignedUrls,
    destinationSignedUrls,
  } = useDashboardTrips();

  const [tripParticipantAvatars, setTripParticipantAvatars] = useState<
    Record<string, (string | null)[]>
  >({});
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "past">(
    "upcoming"
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

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

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className={DASHBOARD_LIST_PAGE_SHELL}>
        <div className="mb-8 flex items-start justify-between gap-2 sm:gap-6">
          <div className="min-w-0 flex-1 pr-1">
            <h1 className="text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
              {getTimeBasedGreeting(new Date())}, {displayName}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 sm:text-base">
              Where would you like to go next?
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-0.5 sm:gap-2 sm:pt-1">
            <button
              type="button"
              onClick={() => setIsAccountOpen(true)}
              className="flex size-8 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 sm:size-10"
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
                className="size-4 sm:size-5"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-full px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 sm:px-4 sm:py-2 sm:text-sm"
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

        <div className="mb-8 flex w-fit gap-1 rounded-full bg-neutral-200 p-1">
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
                  subtitle="Start planning your next adventure"
                  onClick={() => setIsCreateOpen(true)}
                />
              )}
              {filteredTrips.map((t: DashboardTrip) => (
                <TripCard
                  key={t.id}
                  title={t.title}
                  startDate={t.start_date ?? "—"}
                  endDate={t.end_date ?? "—"}
                  coverImageUrl={
                    coverSignedUrls[t.id] ??
                    destinationSignedUrls[t.id] ??
                    t.cover_image_url ??
                    undefined
                  }
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

        {!loadingTrips && !hasAnyTrips && (
          <section className="mb-10 flex justify-center">
            <div className="w-full max-w-md">
              <CreateFirstTripCard
                variant="large"
                titleText="Create Your First Trip"
                subtitle="Start planning your next adventure with all the tools you need"
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
