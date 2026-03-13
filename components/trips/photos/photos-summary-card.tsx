"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { getTripPhotosPreview } from "@/lib/trip-photos/queries";
import type { TripPhotoRow } from "@/lib/trip-photos/queries";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  DASHBOARD_CARD_CONTENT_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  CARD_CONTENT_MT,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
} from "@/components/trip/dashboard-card-styles";

const PHOTOS_BUCKET = "trip-photos";
const SLOT_COUNT = 5;
const ROTATION_INTERVAL_MS = 5000;
const FADE_DURATION_MS = 1800;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersReducedMotion;
}

/**
 * Renders a single thumbnail with cross-fade when the URL changes.
 */
function FadeThumbnail({ url, alt = "" }: { url: string; alt?: string }) {
  const [displayUrl, setDisplayUrl] = useState(url);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (url === displayUrl && url === prevUrl) return;
    if (url !== displayUrl) {
      setPrevUrl(displayUrl);
      setDisplayUrl(url);
      setFadeOut(false);
      const startFade = requestAnimationFrame(() => {
        requestAnimationFrame(() => setFadeOut(true));
      });
      return () => cancelAnimationFrame(startFade);
    }
  }, [url]);

  useEffect(() => {
    if (!fadeOut || !prevUrl) return;
    timeoutRef.current = setTimeout(() => {
      setPrevUrl(null);
      setFadeOut(false);
    }, FADE_DURATION_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fadeOut, prevUrl]);

  return (
    <div className="relative h-full w-full">
      {prevUrl && (
        <img
          src={prevUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--fade-duration)]"
          style={{
            opacity: fadeOut ? 0 : 1,
            ["--fade-duration" as string]: `${FADE_DURATION_MS}ms`,
          }}
          aria-hidden
        />
      )}
      <img
        src={displayUrl}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--fade-duration)] ${prevUrl ? (fadeOut ? "z-[1] opacity-100" : "z-[1] opacity-0") : ""}`}
        style={{ ["--fade-duration" as string]: `${FADE_DURATION_MS}ms` }}
      />
    </div>
  );
}

export interface PhotosSummaryCardProps {
  tripId: string;
}

export function PhotosSummaryCard({ tripId }: PhotosSummaryCardProps) {
  const [totalCount, setTotalCount] = useState(0);
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotIndices, setSlotIndices] = useState<number[]>([]);
  const [nextSlotToReplace, setNextSlotToReplace] = useState(0);
  const [nextPhotoIndex, setNextPhotoIndex] = useState(SLOT_COUNT);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    getTripPhotosPreview(tripId)
      .then(({ photos, totalCount: count }) => {
        if (cancelled) return;
        setTotalCount(count);
        if (photos.length === 0) {
          setThumbnailUrls([]);
          setSlotIndices([]);
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
            const valid = urls.filter((u): u is string => u != null);
            setThumbnailUrls(valid);
            const initial: number[] = Array.from(
              { length: SLOT_COUNT },
              (_, i) => (i < valid.length ? i : -1)
            );
            setSlotIndices(initial);
            setNextSlotToReplace(0);
            setNextPhotoIndex(Math.min(SLOT_COUNT, valid.length));
            setLoading(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTotalCount(0);
          setThumbnailUrls([]);
          setSlotIndices([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const rotateOne = useCallback(() => {
    if (thumbnailUrls.length <= SLOT_COUNT) return;
    setSlotIndices((prev) => {
      const next = [...prev];
      next[nextSlotToReplace] = nextPhotoIndex % thumbnailUrls.length;
      return next;
    });
    setNextSlotToReplace((s) => (s + 1) % SLOT_COUNT);
    setNextPhotoIndex((p) => (p + 1) % thumbnailUrls.length);
  }, [thumbnailUrls.length, nextSlotToReplace, nextPhotoIndex]);

  useEffect(() => {
    if (
      thumbnailUrls.length <= SLOT_COUNT ||
      isPaused ||
      prefersReducedMotion
    )
      return;
    const id = setInterval(rotateOne, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [thumbnailUrls.length, isPaused, prefersReducedMotion, rotateOne]);

  const urlsForSlots = slotIndices.map((idx) =>
    idx >= 0 && idx < thumbnailUrls.length ? thumbnailUrls[idx] : null
  );

  return (
    <Link
      href={`/dashboard/trip/${tripId}/photos`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS} md:col-span-2`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={DASHBOARD_CARD_CONTENT_CLASS}>
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
            {urlsForSlots.map((url, i) => (
              <div
                key={i}
                className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-lg bg-neutral-100"
              >
                {url ? <FadeThumbnail url={url} /> : null}
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
      </div>

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
