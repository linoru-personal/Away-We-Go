"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabaseClient";
import { getTripCoverDisplayUrl } from "@/lib/trip-media/resolve-cover";
import { getTripDestinationDisplayUrl } from "@/lib/trip-media/resolve-destination";
import { tripHasPersistedDestination } from "@/lib/trip-media/parse";

export type DashboardTrip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  /** Canonical cover metadata (trip-media); optional until populated. */
  media?: unknown;
  destination_image_url: string | null;
  created_at: string | null;
};

type DashboardTripsContextValue = {
  trips: DashboardTrip[];
  loadingTrips: boolean;
  refetchTrips: () => Promise<void>;
  /** Sidebar / small list thumbnails. */
  coverThumbSignedUrls: Record<string, string>;
  /** Trip cards and larger previews. */
  coverPreviewSignedUrls: Record<string, string>;
  destinationSignedUrls: Record<string, string>;
};

const DashboardTripsContext = createContext<DashboardTripsContextValue | null>(
  null
);

export function useDashboardTrips(): DashboardTripsContextValue {
  const ctx = useContext(DashboardTripsContext);
  if (!ctx) {
    throw new Error("useDashboardTrips must be used within DashboardTripsProvider");
  }
  return ctx;
}

/** Optional: trip pages that render inside shell without requiring consumer to throw */
export function useDashboardTripsOptional(): DashboardTripsContextValue | null {
  return useContext(DashboardTripsContext);
}

export function DashboardTripsProvider({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const [trips, setTrips] = useState<DashboardTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [coverThumbSignedUrls, setCoverThumbSignedUrls] = useState<
    Record<string, string>
  >({});
  const [coverPreviewSignedUrls, setCoverPreviewSignedUrls] = useState<
    Record<string, string>
  >({});
  const [destinationSignedUrls, setDestinationSignedUrls] = useState<
    Record<string, string>
  >({});

  const refetchTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTrips(data as DashboardTrip[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTrips(true);
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setLoadingTrips(false);
        return;
      }
      setTrips((data ?? []) as DashboardTrip[]);
      setLoadingTrips(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (trips.length === 0) {
      void Promise.resolve().then(() => {
        setCoverThumbSignedUrls({});
        setCoverPreviewSignedUrls({});
      });
      return;
    }
    let cancelled = false;
    Promise.all(
      trips.map(async (t) => {
        const [thumb, preview] = await Promise.all([
          getTripCoverDisplayUrl(supabase, t, "thumb"),
          getTripCoverDisplayUrl(supabase, t, "preview"),
        ]);
        return { id: t.id, thumb, preview };
      })
    ).then((results) => {
      if (cancelled) return;
      const thumbs: Record<string, string> = {};
      const previews: Record<string, string> = {};
      results.forEach((r) => {
        if (r.thumb) thumbs[r.id] = r.thumb;
        if (r.preview) previews[r.id] = r.preview;
      });
      setCoverThumbSignedUrls(thumbs);
      setCoverPreviewSignedUrls(previews);
    });
    return () => {
      cancelled = true;
    };
  }, [trips]);

  useEffect(() => {
    const withDestination = trips.filter((t) => tripHasPersistedDestination(t));
    if (withDestination.length === 0) {
      void Promise.resolve().then(() => setDestinationSignedUrls({}));
      return;
    }
    let cancelled = false;
    Promise.all(
      withDestination.map(async (t) => {
        const url = await getTripDestinationDisplayUrl(supabase, t, "preview");
        return { id: t.id, url };
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      results.forEach((r) => {
        if (r.url) next[r.id] = r.url;
      });
      setDestinationSignedUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [trips]);

  const value = useMemo(
    () => ({
      trips,
      loadingTrips,
      refetchTrips,
      coverThumbSignedUrls,
      coverPreviewSignedUrls,
      destinationSignedUrls,
    }),
    [
      trips,
      loadingTrips,
      refetchTrips,
      coverThumbSignedUrls,
      coverPreviewSignedUrls,
      destinationSignedUrls,
    ]
  );

  return (
    <DashboardTripsContext.Provider value={value}>
      {children}
    </DashboardTripsContext.Provider>
  );
}
