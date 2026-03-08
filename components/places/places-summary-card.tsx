"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  NUMERIC_EMPHASIS_CLASS,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  CARD_CONTENT_MT,
  CARD_CTA_MT,
  CTA_LINK_CLASS,
} from "@/components/trip/dashboard-card-styles";

export type TripPlace = {
  id: string;
  trip_id: string;
  title: string;
  google_maps_url: string;
  notes: string | null;
  created_at: string;
};

export interface PlacesSummaryCardProps {
  tripId: string;
}

function MapPinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0 text-[#8a8a8a]"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function PlacesSummaryCard({ tripId }: PlacesSummaryCardProps) {
  const router = useRouter();
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("trip_places")
      .select("id, trip_id, title, google_maps_url, notes, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setLoading(false);
          return;
        }
        setPlaces((data ?? []) as TripPlace[]);
        setLoading(false);
      });
  }, [tripId]);

  const total = places.length;
  const displayPlaces = places.slice(0, 3);

  return (
    <article className={DASHBOARD_CARD_CLASS}>
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
        onClick={() => router.push(`/dashboard/trip/${tripId}/places`)}
      >
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE_CLASS}>Places</h2>
          <p className={META_CLASS}>
            {loading ? "…" : total === 1 ? "1 place" : `${total} places`}
          </p>
        </div>
        {!loading && total > 0 && (
          <span className={NUMERIC_EMPHASIS_CLASS}>{total}</span>
        )}
      </button>

      {loading ? (
        <p className={`${CARD_CONTENT_MT} text-sm text-[#8a8a8a]`}>Loading…</p>
      ) : displayPlaces.length > 0 ? (
        <>
          <ul className={`${CARD_CONTENT_MT} space-y-2`}>
            {displayPlaces.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-2 text-left"
              >
                <MapPinIcon />
                <span className="min-w-0 flex-1 truncate text-sm text-[#2d2d2d]">
                  {place.title}
                </span>
              </li>
            ))}
          </ul>
          <div className={`${CARD_CTA_MT} text-center`}>
            <button
              type="button"
              className={CTA_LINK_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/trip/${tripId}/places`);
              }}
            >
              Manage Places →
            </button>
          </div>
        </>
      ) : (
        <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
          <p className={EMPTY_STATE_TEXT_CLASS}>
            Add places from Google Maps to plan where you&apos;ll go.
          </p>
          <div className={`${CARD_CTA_MT} text-center`}>
            <button
              type="button"
              className={CTA_LINK_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/trip/${tripId}/places`);
              }}
            >
              Add your first place →
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
