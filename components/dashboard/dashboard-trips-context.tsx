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

export type DashboardTrip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  destination_image_url: string | null;
  created_at: string | null;
};

type DashboardTripsContextValue = {
  trips: DashboardTrip[];
  loadingTrips: boolean;
  refetchTrips: () => Promise<void>;
  coverSignedUrls: Record<string, string>;
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
  const [coverSignedUrls, setCoverSignedUrls] = useState<Record<string, string>>(
    {}
  );
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
    const withDestination = trips.filter((t) => t.destination_image_url);
    if (withDestination.length === 0) {
      setDestinationSignedUrls({});
      return;
    }
    Promise.all(
      withDestination.map(async (t) => {
        const { data, error } = await supabase.storage
          .from("trip-covers")
          .createSignedUrl(t.destination_image_url!, 3600);
        if (error || !data?.signedUrl) return { id: t.id, url: null };
        return { id: t.id, url: data.signedUrl };
      })
    ).then((results) => {
      const next: Record<string, string> = {};
      results.forEach((r) => {
        if (r.url) next[r.id] = r.url;
      });
      setDestinationSignedUrls(next);
    });
  }, [trips]);

  const value = useMemo(
    () => ({
      trips,
      loadingTrips,
      refetchTrips,
      coverSignedUrls,
      destinationSignedUrls,
    }),
    [trips, loadingTrips, refetchTrips, coverSignedUrls, destinationSignedUrls]
  );

  return (
    <DashboardTripsContext.Provider value={value}>
      {children}
    </DashboardTripsContext.Provider>
  );
}
