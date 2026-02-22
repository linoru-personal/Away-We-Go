"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export type TripNote = {
  id: string;
  trip_id: string;
  title: string;
  content: unknown;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export interface TripNotesSummaryCardProps {
  tripId: string;
}

const CARD_CLASS =
  "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

/** Extract plain text from jsonb content for preview (text/list/link/image blocks). */
function getPreviewText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object") {
        const v = (block as { text?: string; value?: string; content?: string }).text
          ?? (block as { text?: string; value?: string }).value
          ?? (block as { content?: string }).content;
        if (typeof v === "string") parts.push(v);
      }
    }
    return parts.join(" ").trim();
  }
  if (typeof content === "object") {
    const v = (content as { text?: string }).text ?? (content as { value?: string }).value;
    return typeof v === "string" ? v.trim() : "";
  }
  return "";
}

export function TripNotesSummaryCard({ tripId }: TripNotesSummaryCardProps) {
  const router = useRouter();
  const [total, setTotal] = useState(0);
  const [latestNote, setLatestNote] = useState<TripNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    Promise.all([
      supabase
        .from("trip_notes")
        .select("id, trip_id, title, content, tags, created_at, updated_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("trip_notes")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId),
    ]).then(([latestRes, countRes]) => {
      if (latestRes.error) {
        setLatestNote(null);
      } else {
        const list = (latestRes.data ?? []) as TripNote[];
        setLatestNote(list[0] ?? null);
      }
      setTotal(countRes.count ?? 0);
      setLoading(false);
    });
  }, [tripId]);
  const previewText = latestNote ? getPreviewText(latestNote.content) : "";

  return (
    <article className={CARD_CLASS}>
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-start">
          <h2 className="text-lg font-semibold text-[#4A4A4A]">Trip Notes</h2>
          <p className="mt-0.5 text-sm text-[#9B7B6B]">
            Your travel knowledge base
          </p>
        </div>
        {!loading && (
          <span className="text-2xl font-semibold text-[#E07A5F]">
            {total}
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-start text-sm text-[#6B7280]">Loading…</p>
      ) : latestNote ? (
        <>
          <p className="mt-4 text-start text-sm font-semibold text-[#4A4A4A]">
            {latestNote.title}
          </p>
          <p className="mt-1 line-clamp-2 text-start text-sm text-[#6B7280]">
            {previewText || "No content"}
          </p>
        </>
      ) : (
        <p className="mt-4 text-start text-sm text-[#9B7B6B]">No notes yet.</p>
      )}

      {!loading && (
        <div className="mt-5 text-start">
          <button
            type="button"
            className="text-sm font-medium text-[#E07A5F] transition hover:text-[#c46950]"
            onClick={() => router.push(`/dashboard/trip/${tripId}/notes`)}
          >
            Manage Trip Notes →
          </button>
        </div>
      )}
    </article>
  );
}
