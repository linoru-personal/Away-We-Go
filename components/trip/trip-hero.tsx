"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { TRIP_HERO_ASPECT_CLASS } from "@/lib/image-presets";

export interface TripHeroProps {
  title?: string;
  dates?: string;
  imageUrl?: string;
  onBack?: () => void;
  /** Rendered in the top row (e.g. overflow menu) */
  topRight?: ReactNode;
  /** When set, replaces the default title + dates block */
  titleContent?: ReactNode;
  /** When set, shows an edit icon next to the title and calls this on click */
  onEditTitle?: () => void;
  /** Optional participant avatars (signed URLs). Shown as overlapping circles; fallback to initial if null. */
  participants?: { avatarUrl?: string | null }[];
}

function BackArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 sm:size-5"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function EditPencilIcon() {
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
    </svg>
  );
}

export default function TripHero({
  title = "Reykjavik, Iceland",
  dates = "Apr 10 - 17, 2026",
  imageUrl,
  onBack,
  topRight,
  titleContent,
  onEditTitle,
  participants,
}: TripHeroProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl ${TRIP_HERO_ASPECT_CLASS}`}
    >
      {/* Background image — aspect matches TRIP_HERO_PRESET / cover crop UI */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 1536px) 100vw, 1536px"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-300" />
      )}

      {/* Dark overlay gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden
      />

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-3.5 sm:p-5">
        {/* Top row: back button + optional right slot */}
        <div className="flex items-start justify-between">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 sm:size-10"
            aria-label="Back"
            onClick={onBack}
          >
            <BackArrowIcon />
          </button>
          {topRight != null && <div className="shrink-0">{topRight}</div>}
        </div>

        {/* Bottom: title content or default title + dates + avatars */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            {titleContent != null ? (
              titleContent
            ) : (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-xl font-bold leading-tight text-white drop-shadow-sm sm:text-3xl md:text-4xl">
                    {title}
                  </h1>
                  {onEditTitle != null && (
                    <button
                      type="button"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 sm:size-8"
                      aria-label="Edit title"
                      onClick={onEditTitle}
                    >
                      <EditPencilIcon />
                    </button>
                  )}
                </div>
                <p className="text-sm text-white/90 sm:text-base md:text-lg">{dates}</p>
                {/* Overlapping avatar circles */}
                <div className="mt-2 flex -space-x-2 sm:mt-3">
                  {participants && participants.length > 0 ? (
                    participants.slice(0, 5).map((p, i) => (
                      <div
                        key={i}
                        className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-neutral-500 sm:size-9"
                      >
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-white/80">?</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="size-7 rounded-full border-2 border-white bg-neutral-400 sm:size-9" />
                      <div className="size-7 rounded-full border-2 border-white bg-neutral-500 sm:size-9" />
                      <div className="size-7 rounded-full border-2 border-white bg-neutral-600 sm:size-9" />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
