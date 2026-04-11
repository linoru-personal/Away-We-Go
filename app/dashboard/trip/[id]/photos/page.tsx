"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import { getTripPhotos } from "@/lib/trip-photos/queries";
import type { PhotoWithUrl } from "@/components/trips/photos/photos-section";
import { PhotosPageClient } from "./photos-page-client";
import { formatTripDateRange } from "@/lib/format-trip-dates";
import { DASHBOARD_TRIP_SUBPAGE_SHELL } from "@/components/trip/dashboard-card-styles";
import { fetchTripByIdForUser } from "@/lib/fetch-trip-for-user";
import { useTripCoverSignedUrl } from "@/app/lib/useTripCoverSignedUrl";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  media?: unknown;
};

const PHOTOS_BUCKET = "trip-photos";

export default function TripPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { canEditContent } = useTripRole(trip, user?.id ?? undefined);
  const [tripLoading, setTripLoading] = useState(true);
  const coverImageUrl = useTripCoverSignedUrl(trip, "preview");
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);
  const [photosWithUrls, setPhotosWithUrls] = useState<PhotoWithUrl[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

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
    fetchTripByIdForUser<Trip>(
      supabase,
      id,
      "id, user_id, title, start_date, end_date, cover_image_url, cover_image_path, media"
    ).then(({ trip, error }) => {
      if (cancelled) return;
      if (!error && trip) setTrip(trip);
      setTripLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!id) {
      setParticipantAvatarUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("avatar_path, sort_order")
      .eq("trip_id", id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null }[];
        Promise.all(
          rows.map(async (r) => {
            if (!r.avatar_path) return null;
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(r.avatar_path, 3600);
            return signed?.signedUrl ?? null;
          })
        ).then((urls) => {
          if (!cancelled) setParticipantAvatarUrls(urls);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      setPhotosWithUrls([]);
      setPhotosLoading(false);
      return;
    }
    let cancelled = false;
    getTripPhotos(id)
      .then((photos) => {
        if (cancelled) return;
        if (photos.length === 0) {
          setPhotosWithUrls([]);
          setPhotosLoading(false);
          return;
        }
        Promise.all(
          photos.map((p) =>
            supabase.storage
              .from(PHOTOS_BUCKET)
              .createSignedUrl(p.image_path, 3600)
              .then(({ data: signed }) => ({
                id: p.id,
                trip_id: p.trip_id,
                image_path: p.image_path,
                caption: p.caption,
                created_at: p.created_at,
                imageUrl: signed?.signedUrl ?? "",
              }))
          )
        ).then((withUrls) => {
          if (!cancelled) {
            setPhotosWithUrls(withUrls);
          }
          setPhotosLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPhotosWithUrls([]);
          setPhotosLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const refetchPhotos = useCallback(() => {
    if (!id) return;
    getTripPhotos(id)
      .then((photos) => {
        if (photos.length === 0) {
          setPhotosWithUrls([]);
          return;
        }
        return Promise.all(
          photos.map((p) =>
            supabase.storage
              .from(PHOTOS_BUCKET)
              .createSignedUrl(p.image_path, 3600)
              .then(({ data: signed }) => ({
                id: p.id,
                trip_id: p.trip_id,
                image_path: p.image_path,
                caption: p.caption,
                created_at: p.created_at,
                imageUrl: signed?.signedUrl ?? "",
              }))
          )
        ).then((withUrls) => setPhotosWithUrls(withUrls));
      })
      .catch(() => setPhotosWithUrls([]));
  }, [id]);

  if (sessionLoading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-[#6B7280]">
        Loading...
      </p>
    );
  }

  if (!user) return null;

  if (!id) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className={DASHBOARD_TRIP_SUBPAGE_SHELL}>
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  if (tripLoading) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className={DASHBOARD_TRIP_SUBPAGE_SHELL}>
          <p className="text-[#6B7280]">Loading…</p>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className={DASHBOARD_TRIP_SUBPAGE_SHELL}>
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
        </div>
      </main>
    );
  }

  const dates = formatTripDateRange(trip.start_date, trip.end_date);

  return (
    <PhotosPageClient
      tripId={trip.id}
      title={trip.title}
      dates={dates}
      coverImageUrl={coverImageUrl ?? null}
      participantAvatarUrls={participantAvatarUrls}
      photos={photosLoading ? [] : photosWithUrls}
      canEditContent={canEditContent}
      onUploadSuccess={refetchPhotos}
    />
  );
}
