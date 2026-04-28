"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/lib/useSession";
import { supabase } from "@/app/lib/supabaseClient";
import { PhotoUploadForm } from "./photo-upload-form";
import type { PhotoWithUrl } from "@/lib/trip-photos/gallery-types";

export type { PhotoWithUrl };

async function deleteTripPhoto(
  tripId: string,
  photoId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}/photos/${photoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const msg =
    typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : `Delete failed (${res.status}).`;
  throw new Error(msg);
}

export interface PhotosSectionProps {
  tripId: string;
  photos: PhotoWithUrl[];
  /** True while the first gallery page is loading (shows loading instead of empty state). */
  photosInitialLoading?: boolean;
  photosHasMore?: boolean;
  photosLoadingMore?: boolean;
  onLoadMorePhotos?: () => void | Promise<void>;
  /** When false (e.g. viewer), hide upload form and delete on photos. Default true. */
  canEditContent?: boolean;
  onUploadSuccess?: () => void;
  /** Called after a successful delete so the parent can refetch the gallery. */
  onGalleryChanged?: () => void;
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
  tripId,
  photo,
  canDelete,
  onDelete,
}: {
  tripId: string;
  photo: PhotoWithUrl;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#ebe5df] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="aspect-square w-full bg-neutral-100">
        {photo.thumbUrl ? (
          <img
            src={photo.thumbUrl}
            alt={photo.caption ?? "Trip photo"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-[#9a9a9a]">
            Preview unavailable
          </div>
        )}
      </div>
      {photo.caption && (
        <p className="p-2 text-sm text-[#2d2d2d]">{photo.caption}</p>
      )}
      {canDelete && (
      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          setDeleteError(null);
          setDeleting(true);
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
              setDeleteError("Your session expired. Please sign in again.");
              return;
            }
            await deleteTripPhoto(tripId, photo.id, session.access_token);
            onDelete();
          } catch (e) {
            setDeleteError(
              e instanceof Error ? e.message : "Could not delete photo."
            );
          } finally {
            setDeleting(false);
          }
        }}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-60"
        aria-label="Delete photo"
      >
        <TrashIcon />
      </button>
      )}
      {deleteError ? (
        <p className="absolute bottom-0 left-0 right-0 bg-red-900/85 px-2 py-1 text-center text-xs text-white">
          {deleteError}
        </p>
      ) : null}
    </div>
  );
}

export function PhotosSection({
  tripId,
  photos,
  photosInitialLoading = false,
  photosHasMore = false,
  photosLoadingMore = false,
  onLoadMorePhotos,
  canEditContent = true,
  onUploadSuccess,
  onGalleryChanged,
}: PhotosSectionProps) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const handlePhotoDeleted = () => {
    onGalleryChanged?.();
    router.refresh();
  };

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
      <PhotoUploadForm tripId={tripId} onUploadSuccess={onUploadSuccess} />
      )}

      {photosInitialLoading && photos.length === 0 ? (
        <p className="rounded-xl border border-[#ebe5df] bg-[#FAFAF8] py-8 text-center text-sm text-[#8a8a8a]">
          Loading photos…
        </p>
      ) : photos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                tripId={tripId}
                photo={photo}
                canDelete={canEditContent}
                onDelete={handlePhotoDeleted}
              />
            ))}
          </div>
          {photosHasMore && onLoadMorePhotos ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={photosLoadingMore}
                onClick={() => void onLoadMorePhotos()}
                className="rounded-lg border border-[#ebe5df] bg-white px-4 py-2 text-sm font-medium text-[#2d2d2d] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition hover:bg-[#FAFAF8] disabled:opacity-60"
              >
                {photosLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-[#ebe5df] bg-[#FAFAF8] py-8 text-center text-sm text-[#8a8a8a]">
          {canEditContent ? "No photos yet. Add one above." : "No photos yet."}
        </p>
      )}
    </div>
  );
}
