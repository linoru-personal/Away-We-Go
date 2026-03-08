"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  NUMERIC_EMPHASIS_CLASS,
  PROGRESS_TRACK_CLASS,
  PROGRESS_FILL_CLASS,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  CARD_CONTENT_MT,
  CARD_CTA_MT,
  CTA_LINK_CLASS,
} from "@/components/trip/dashboard-card-styles";

type PackingItemRow = {
  id: string;
  trip_id: string;
  title: string;
  is_packed: boolean;
};

export interface PackingSummaryCardProps {
  tripId: string;
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2.5"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function PackingSummaryCard({ tripId }: PackingSummaryCardProps) {
  const router = useRouter();
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("packing_items")
      .select("id, trip_id, title, is_packed")
      .eq("trip_id", tripId)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setLoading(false);
          return;
        }
        setItems((data ?? []) as PackingItemRow[]);
        setLoading(false);
      });
  }, [tripId]);

  const total = items.length;
  const packed = items.filter((i) => i.is_packed).length;
  const progressValue = total > 0 ? Math.round((packed / total) * 100) : 0;
  const displayItems = items.slice(0, 4);

  return (
    <article className={DASHBOARD_CARD_CLASS}>
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
        onClick={() => router.push(`/dashboard/trip/${tripId}/packing`)}
      >
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE_CLASS}>Packing</h2>
          <p className={META_CLASS}>
            {loading ? "…" : `${packed} of ${total} packed`}
          </p>
        </div>
        {!loading && (
          <span className={NUMERIC_EMPHASIS_CLASS}>{total - packed}</span>
        )}
      </button>

      {loading ? (
        <p className={`${CARD_CONTENT_MT} text-sm text-[#8a8a8a]`}>Loading…</p>
      ) : (
        <>
          <div className={`${CARD_CONTENT_MT} ${PROGRESS_TRACK_CLASS}`}>
            <div
              className={PROGRESS_FILL_CLASS}
              style={{ width: `${progressValue}%` }}
            />
          </div>

          {displayItems.length > 0 ? (
            <ul className={`${CARD_CONTENT_MT} space-y-3`}>
              {displayItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                      item.is_packed
                        ? "border-[#E07A5F] bg-[#E07A5F]"
                        : "border-[#D4C5BA] bg-white"
                    }`}
                  >
                    {item.is_packed && <CheckIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        item.is_packed
                          ? "text-sm text-[#9B7B6B] line-through"
                          : "text-sm text-[#6B7280]"
                      }
                    >
                      {item.title}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
              <p className={EMPTY_STATE_TEXT_CLASS}>No packing items yet</p>
            </div>
          )}

          <div className={`${CARD_CTA_MT} text-center`}>
            <button
              type="button"
              className={CTA_LINK_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/trip/${tripId}/packing`);
              }}
            >
              Manage Packing →
            </button>
          </div>
        </>
      )}
    </article>
  );
}
