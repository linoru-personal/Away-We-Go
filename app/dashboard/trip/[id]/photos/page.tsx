"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import { getTripPhotosPage } from "@/lib/trip-photos/queries";
import { mapTripPhotosToGalleryUrls } from "@/lib/trip-photos/gallery-urls";
import type { PhotoWithUrl } from "@/lib/trip-photos/gallery-types";
import { PhotosPageClient } from "./photos-page-client";
import { formatTripDateRange } from "@/lib/format-trip-dates";
import { DASHBOARD_TRIP_SUBPAGE_SHELL } from "@/components/trip/dashboard-card-styles";
import { fetchTripByIdForUser } from "@/lib/fetch-trip-for-user";
import { useTripCoverSignedUrl } from "@/app/lib/useTripCoverSignedUrl";
import { getParticipantAvatarDisplayUrl } from "@/lib/trip-media/resolve-participant-avatar";

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
  const [photosLoadingMore, setPhotosLoadingMore] = useState(false);
  const [photosHasMore, setPhotosHasMore] = useState(false);
  const [nextPhotoOffset, setNextPhotoOffset] = useState(0);

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
      .select("avatar_path, media, sort_order")
      .eq("trip_id", id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null; media?: unknown }[];
        Promise.all(
          rows.map((r) => getParticipantAvatarDisplayUrl(supabase, r, "thumb"))
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
      setPhotosHasMore(false);
      setNextPhotoOffset(0);
      return;
    }
    let cancelled = false;
    setPhotosLoading(true);
    getTripPhotosPage(id, 0)
      .then(({ photos: rows, totalCount }) => {
        if (cancelled) return;
        if (rows.length === 0) {
          setPhotosWithUrls([]);
          setNextPhotoOffset(0);
          setPhotosHasMore(false);
          setPhotosLoading(false);
          return;
        }
        return mapTripPhotosToGalleryUrls(supabase, rows)
          .then((withUrls) => {
            if (!cancelled) setPhotosWithUrls(withUrls);
          })
          .catch(() => {
            if (!cancelled) setPhotosWithUrls([]);
          })
          .finally(() => {
            if (cancelled) return;
            setNextPhotoOffset(rows.length);
            setPhotosHasMore(rows.length < totalCount);
            setPhotosLoading(false);
          });
      })
      .catch(() => {
        if (!cancelled) {
          setPhotosWithUrls([]);
          setPhotosHasMore(false);
          setNextPhotoOffset(0);
          setPhotosLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadMorePhotos = useCallback(async () => {
    if (!id || photosLoadingMore || !photosHasMore) return;
    setPhotosLoadingMore(true);
    try {
      const { photos: rows, totalCount } = await getTripPhotosPage(id, nextPhotoOffset);
      if (rows.length === 0) {
        setPhotosHasMore(false);
        return;
      }
      const mapped = await mapTripPhotosToGalleryUrls(supabase, rows);
      setPhotosWithUrls((prev) => [...prev, ...mapped]);
      const end = nextPhotoOffset + rows.length;
      setNextPhotoOffset(end);
      setPhotosHasMore(end < totalCount);
    } catch {
      setPhotosHasMore(false);
    } finally {
      setPhotosLoadingMore(false);
    }
  }, [id, nextPhotoOffset, photosLoadingMore, photosHasMore]);

  const refetchPhotos = useCallback(() => {
    if (!id) return;
    setPhotosLoading(true);
    getTripPhotosPage(id, 0)
      .then(({ photos: rows, totalCount }) => {
        if (rows.length === 0) {
          setPhotosWithUrls([]);
          setNextPhotoOffset(0);
          setPhotosHasMore(false);
          return;
        }
        return mapTripPhotosToGalleryUrls(supabase, rows).then((mapped) => {
          setPhotosWithUrls(mapped);
          setNextPhotoOffset(rows.length);
          setPhotosHasMore(rows.length < totalCount);
        });
      })
      .catch(() => {
        setPhotosWithUrls([]);
        setPhotosHasMore(false);
        setNextPhotoOffset(0);
      })
      .finally(() => setPhotosLoading(false));
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
      photos={photosWithUrls}
      photosInitialLoading={photosLoading}
      photosHasMore={photosHasMore}
      photosLoadingMore={photosLoadingMore}
      onLoadMorePhotos={loadMorePhotos}
      canEditContent={canEditContent}
      onUploadSuccess={refetchPhotos}
      onGalleryChanged={refetchPhotos}
    />
  );
}
