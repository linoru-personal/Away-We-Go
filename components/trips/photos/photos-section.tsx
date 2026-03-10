"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/lib/useSession";
import { supabase } from "@/app/lib/supabaseClient";
import { PhotoUploadForm } from "./photo-upload-form";

export type PhotoWithUrl = {
  id: string;
  trip_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  imageUrl: string;
};

export interface PhotosSectionProps {
  tripId: string;
  photos: PhotoWithUrl[];
  /** When false (e.g. viewer), hide upload form and delete on photos. Default true. */
  canEditContent?: boolean;
  onUploadSuccess?: () => void;
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function PhotoCard({
  photo,
  canDelete,
  onDelete,
}: {
  photo: PhotoWithUrl;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#ebe5df] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="aspect-square w-full bg-neutral-100">
        <img
          src={photo.imageUrl}
          alt={photo.caption ?? "Trip photo"}
          className="h-full w-full object-cover"
        />
      </div>
      {photo.caption && (
        <p className="p-2 text-sm text-[#2d2d2d]">{photo.caption}</p>
      )}
      {canDelete && (
      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          await supabase.from("trip_photos").delete().eq("id", photo.id);
          onDelete();
        }}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-60"
        aria-label="Delete photo"
      >
        <TrashIcon />
      </button>
      )}
    </div>
  );
}

export function PhotosSection({ tripId, photos, canEditContent = true, onUploadSuccess }: PhotosSectionProps) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  if (sessionLoading) {
    return (
      <p className="py-6 text-[#6B7280]">Loading…</p>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[#2d2d2d]">Photos</h1>
        <span className="text-sm text-[#8a8a8a]">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
          {!canEditContent && " (read-only)"}
        </span>
      </div>

      {canEditContent && (
      <PhotoUploadForm tripId={tripId} userId={user.id} onUploadSuccess={onUploadSuccess} />
      )}

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              canDelete={canEditContent}
              onDelete={() => router.refresh()}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[#ebe5df] bg-[#FAFAF8] py-8 text-center text-sm text-[#8a8a8a]">
          {canEditContent ? "No photos yet. Add one above." : "No photos yet."}
        </p>
      )}
    </div>
  );
}
