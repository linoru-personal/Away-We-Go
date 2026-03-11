"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  DASHBOARD_CARD_CONTENT_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  PROGRESS_TRACK_CLASS,
  PROGRESS_FILL_CLASS,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  CARD_CONTENT_MT,
} from "@/components/trip/dashboard-card-styles";

type PackingItemRow = {
  id: string;
  trip_id: string;
  title: string;
  is_packed: boolean;
  assigned_to_participant_id: string | null;
};

type ParticipantRow = {
  id: string;
  name: string;
};

export interface PackingSummaryCardProps {
  tripId: string;
  /** Optional trip cover image URL for the "Everyone" row icon. */
  tripCoverImageUrl?: string | null;
}

export function PackingSummaryCard({ tripId, tripCoverImageUrl }: PackingSummaryCardProps) {
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    (async () => {
      const [itemsRes, partRes] = await Promise.all([
        supabase
          .from("packing_items")
          .select("id, trip_id, title, is_packed, assigned_to_participant_id")
          .eq("trip_id", tripId),
        supabase
          .from("trip_participants")
          .select("id, name, avatar_path, sort_order")
          .eq("trip_id", tripId)
          .order("sort_order", { ascending: true }),
      ]);

      if (cancelled) return;
      if (!itemsRes.error && itemsRes.data) setItems((itemsRes.data ?? []) as PackingItemRow[]);
      if (!partRes.error && partRes.data) {
        const rows = (partRes.data ?? []) as { id: string; name: string; avatar_path: string | null }[];
        setParticipants(rows.map((r) => ({ id: r.id, name: r.name })));
        const urls = await Promise.all(
          rows.map(async (r) => {
            if (!r.avatar_path) return null;
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(r.avatar_path, 3600);
            return signed?.signedUrl ?? null;
          })
        );
        if (!cancelled) setParticipantAvatarUrls(urls);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const total = items.length;
  const packed = items.filter((i) => i.is_packed).length;
  const progressValue = total > 0 ? Math.round((packed / total) * 100) : 0;

  const everyoneItems = items.filter((i) => !i.assigned_to_participant_id);
  const byParticipant = participants.map((p) => {
    const assigned = items.filter((i) => i.assigned_to_participant_id === p.id);
    return { participant: p, assigned, packed: assigned.filter((i) => i.is_packed).length };
  });
  const participantStats: { key: string; label: string; avatarUrl: string | null; total: number; packed: number }[] = [
    ...(everyoneItems.length > 0
      ? [{ key: "__everyone__", label: "Everyone", avatarUrl: (tripCoverImageUrl ?? null) as string | null, total: everyoneItems.length, packed: everyoneItems.filter((i) => i.is_packed).length }]
      : []),
    ...byParticipant
      .filter((x) => x.assigned.length > 0)
      .map((x, i) => ({
        key: x.participant.id,
        label: x.participant.name,
        avatarUrl: participantAvatarUrls[i] ?? null,
        total: x.assigned.length,
        packed: x.packed,
      })),
  ];

  return (
    <Link
      href={`/dashboard/trip/${tripId}/packing`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS}`}
    >
      <div className={DASHBOARD_CARD_CONTENT_CLASS}>
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className={SECTION_TITLE_CLASS}>Packing</h2>
            <p className={META_CLASS}>
              {loading ? "…" : `${packed} of ${total} packed`}
            </p>
          </div>
        </div>

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

          {participantStats.length > 0 ? (
            <ul className={`${CARD_CONTENT_MT} space-y-2`}>
              {participantStats.map((stat) => (
                <li key={stat.key} className="flex items-center gap-2">
                  {stat.avatarUrl ? (
                    <img
                      src={stat.avatarUrl}
                      alt=""
                      className="size-6 shrink-0 rounded-full object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E8E4E0] text-xs font-medium text-[#6B7280]"
                      aria-hidden
                    >
                      {stat.label.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-[#2d2d2d]">
                    {stat.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#8a8a8a]">
                    {stat.packed}/{stat.total}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
              <p className={EMPTY_STATE_TEXT_CLASS}>No packing items yet</p>
            </div>
          )}
        </>
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
