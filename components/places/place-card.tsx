"use client";

import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  CTA_LINK_CLASS,
} from "@/components/trip/dashboard-card-styles";

export type TripPlace = {
  id: string;
  trip_id: string;
  title: string;
  google_maps_url: string;
  notes: string | null;
  category_id: string | null;
  created_at: string;
};

/** Resolved category for display (name + icon). */
export type PlaceCategoryDisplay = {
  name: string;
  icon: string | null;
} | null;

export interface PlaceCardProps {
  place: TripPlace;
  category: PlaceCategoryDisplay;
  onEdit: (place: TripPlace) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
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

export function PlaceCard({ place, category, onEdit, onDelete, deletingId }: PlaceCardProps) {
  const isDeleting = deletingId === place.id;

  return (
    <article className={DASHBOARD_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={SECTION_TITLE_CLASS}>{place.title}</h3>
          {category && (
            <p className={`${META_CLASS} mt-0.5 text-[#8a8a8a]`}>
              <span aria-hidden>{category.icon ?? "•"}</span> {category.name}
            </p>
          )}
          {place.notes?.trim() && (
            <p className={`${META_CLASS} mt-1.5 text-[#2d2d2d]`}>
              {place.notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={place.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 ${CTA_LINK_CLASS}`}
          >
            <ExternalLinkIcon />
            Open in Google Maps
          </a>
          <button
            type="button"
            className="rounded p-1.5 text-[#8a8a8a] transition hover:bg-[#F5F3F0] hover:text-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-50"
            onClick={() => onEdit(place)}
            disabled={isDeleting}
            aria-label="Edit place"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-[#8a8a8a] transition hover:bg-[#F5F3F0] hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-50"
            onClick={() => onDelete(place.id)}
            disabled={isDeleting}
            aria-label="Delete place"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {isDeleting && (
        <p className="mt-2 text-sm text-[#8a8a8a]">Deleting…</p>
      )}
    </article>
  );
}
