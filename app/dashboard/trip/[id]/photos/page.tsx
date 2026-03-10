"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import { getTripPhotos } from "@/lib/trip-photos/queries";
import type { PhotoWithUrl } from "@/components/trips/photos/photos-section";
import { PhotosPageClient } from "./photos-page-client";

type Trip = {
  id: string;
  user_id?: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
};

const PHOTOS_BUCKET = "trip-photos";
const TRIP_COVERS_BUCKET = "trip-covers";

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? "—";
}

export default function TripPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { canEditContent } = useTripRole(trip, user?.id ?? undefined);
  const [tripLoading, setTripLoading] = useState(true);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
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
    supabase
      .from("trips")
      .select("id, user_id, title, start_date, end_date, cover_image_url, cover_image_path")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setTrip(data as Trip);
          if (data.cover_image_path) {
            supabase.storage
              .from(TRIP_COVERS_BUCKET)
              .createSignedUrl(data.cover_image_path, 3600)
              .then(({ data: cover }) => {
                if (!cancelled && cover?.signedUrl)
                  setCoverImageUrl(cover.signedUrl);
              });
          }
        }
        setTripLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

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
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  if (tripLoading) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Loading…</p>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
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

  const dates = formatDates(trip.start_date, trip.end_date);

  return (
    <PhotosPageClient
      tripId={trip.id}
      title={trip.title}
      dates={dates}
      coverImageUrl={coverImageUrl ?? trip.cover_image_url ?? null}
      photos={photosLoading ? [] : photosWithUrls}
      canEditContent={canEditContent}
      onUploadSuccess={refetchPhotos}
    />
  );
}
