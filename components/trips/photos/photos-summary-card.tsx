"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { getTripPhotosPreview } from "@/lib/trip-photos/queries";
import type { TripPhotoRow } from "@/lib/trip-photos/queries";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  CARD_CONTENT_MT,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
} from "@/components/trip/dashboard-card-styles";

const PHOTOS_BUCKET = "trip-photos";

export interface PhotosSummaryCardProps {
  tripId: string;
}

export function PhotosSummaryCard({ tripId }: PhotosSummaryCardProps) {
  const [totalCount, setTotalCount] = useState(0);
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    getTripPhotosPreview(tripId)
      .then(({ photos, totalCount: count }) => {
        if (cancelled) return;
        setTotalCount(count);
        if (photos.length === 0) {
          setThumbnailUrls([]);
          setLoading(false);
          return;
        }
        Promise.all(
          photos.map((p: TripPhotoRow) =>
            supabase.storage
              .from(PHOTOS_BUCKET)
              .createSignedUrl(p.image_path, 3600)
              .then(({ data }) => data?.signedUrl ?? null)
          )
        ).then((urls) => {
          if (!cancelled) {
            setThumbnailUrls(urls.filter((u): u is string => u != null));
            setLoading(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTotalCount(0);
          setThumbnailUrls([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return (
    <Link
      href={`/dashboard/trip/${tripId}/photos`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS} md:col-span-2`}
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE_CLASS}>Photos</h2>
          <p className={META_CLASS}>
            {loading ? "…" : `${totalCount} ${totalCount === 1 ? "photo" : "photos"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className={`${CARD_CONTENT_MT} text-sm text-[#8a8a8a]`}>Loading…</p>
      ) : thumbnailUrls.length > 0 ? (
        <div className={`${CARD_CONTENT_MT} flex gap-2`}>
          {thumbnailUrls.slice(0, 3).map((url, i) => (
            <div
              key={i}
              className="aspect-square w-full max-w-[120px] overflow-hidden rounded-lg bg-neutral-100"
            >
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
          <p className={EMPTY_STATE_TEXT_CLASS}>
            Photos from your trip will appear here
          </p>
        </div>
      )}

      <span className={DASHBOARD_CARD_CHEVRON_CLASS} aria-hidden>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={DASHBOARD_CARD_CHEVRON_ICON_CLASS}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </Link>
  );
}
