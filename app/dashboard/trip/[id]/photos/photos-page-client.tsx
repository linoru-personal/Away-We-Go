"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/lib/useSession";
import TripHero from "@/components/trip/trip-hero";
import { PhotosSection, type PhotoWithUrl } from "@/components/trips/photos/photos-section";

export interface PhotosPageClientProps {
  tripId: string;
  title: string;
  dates: string;
  coverImageUrl: string | null;
  photos: PhotoWithUrl[];
  /** When false (e.g. viewer), hide upload and delete. Default true. */
  canEditContent?: boolean;
  onUploadSuccess?: () => void;
}

export function PhotosPageClient({
  tripId,
  title,
  dates,
  coverImageUrl,
  photos,
  canEditContent = true,
  onUploadSuccess,
}: PhotosPageClientProps) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
    }
  }, [sessionLoading, user, router]);

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[#F8F6F4]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Loading…</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#F8F6F4]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        <TripHero
          title={title}
          dates={dates}
          imageUrl={coverImageUrl ?? undefined}
          onBack={() => router.push(`/dashboard/trip/${tripId}`)}
        />
        <div className="mt-8">
          <PhotosSection tripId={tripId} photos={photos} canEditContent={canEditContent} onUploadSuccess={onUploadSuccess} />
        </div>
      </div>
    </main>
  );
}
