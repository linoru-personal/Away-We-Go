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
const TRIP_NOTES_BUCKET = "trip-notes";

type ContentBlock = {
  type: string;
  text?: string;
  items?: string[];
  url?: string;
  title?: string;
  path?: string;
  bucket?: string;
};

function getBlocks(content: unknown): ContentBlock[] {
  if (content == null || typeof content !== "object") return [];
  const obj = content as { blocks?: unknown };
  if (!obj.blocks || !Array.isArray(obj.blocks)) return [];
  return obj.blocks as ContentBlock[];
}

/** First image block path/bucket for thumbnail, or null. */
function getPreviewImagePath(content: unknown): { path: string; bucket: string } | null {
  const blocks = getBlocks(content);
  const imageBlock = blocks.find((b) => b.type === "image" && b.path);
  if (!imageBlock || !imageBlock.path) return null;
  return {
    path: imageBlock.path,
    bucket: imageBlock.bucket || TRIP_NOTES_BUCKET,
  };
}

/** Build preview string from note content blocks (image → link → list → text). ~2 lines max. */
function getPreviewFromBlocks(content: unknown): string {
  const blocks = getBlocks(content);
  if (blocks.length === 0) return "";

  const imageBlock = blocks.find((b) => b.type === "image");
  if (imageBlock) return "";

  const linkBlock = blocks.find((b) => b.type === "link" && b.url);
  if (linkBlock && linkBlock.url) {
    const title = linkBlock.title?.trim();
    if (title) return title;
    try {
      return new URL(linkBlock.url).hostname;
    } catch {
      return linkBlock.url.slice(0, 50);
    }
  }

  const listBlock = blocks.find(
    (b) => b.type === "list" && Array.isArray(b.items) && b.items.length > 0
  );
  if (listBlock && listBlock.items) {
    const items = listBlock.items.slice(0, 2).map((i) => (typeof i === "string" ? i : String(i)));
    return items.join(" • ");
  }

  const textBlock = blocks.find((b) => b.type === "text" && b.text);
  if (textBlock && typeof textBlock.text === "string") {
    const t = textBlock.text.trim();
    const lines = t.split(/\n/).filter(Boolean).slice(0, 2);
    return lines.join(" ");
  }

  return "";
}

export function TripNotesSummaryCard({ tripId }: TripNotesSummaryCardProps) {
  const router = useRouter();
  const [total, setTotal] = useState(0);
  const [latestNote, setLatestNote] = useState<TripNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [thumbnailSignedUrl, setThumbnailSignedUrl] = useState<string | null>(null);

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

  const previewImage = latestNote ? getPreviewImagePath(latestNote.content) : null;

  useEffect(() => {
    if (!previewImage) {
      setThumbnailSignedUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(previewImage.bucket)
      .createSignedUrl(previewImage.path, 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) {
          setThumbnailSignedUrl(data.signedUrl);
        } else {
          setThumbnailSignedUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) setThumbnailSignedUrl(null);
      });
    return () => {
      cancelled = true;
      setThumbnailSignedUrl(null);
    };
  }, [previewImage?.bucket, previewImage?.path]);

  const previewText = latestNote ? getPreviewFromBlocks(latestNote.content) : "";

  return (
    <article className={`${CARD_CLASS} flex flex-col h-full`}>
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
          <div className="mt-1 flex items-start gap-2">
            {thumbnailSignedUrl && (
              <img
                src={thumbnailSignedUrl}
                alt=""
                className="size-12 shrink-0 rounded object-cover"
              />
            )}
            <p className="min-w-0 flex-1 line-clamp-2 text-start text-sm text-[#6B7280]">
              {previewText || (previewImage ? "" : "No content")}
            </p>
          </div>
        </>
      ) : (
        <p className="mt-4 text-start text-sm text-[#9B7B6B]">No notes yet.</p>
      )}

      {!loading && (
        <>
          <div className="mt-auto" aria-hidden />
          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-medium text-[#E07A5F] transition hover:text-[#c46950]"
              onClick={() => router.push(`/dashboard/trip/${tripId}/notes`)}
            >
              Manage Trip Notes →
            </button>
          </div>
        </>
      )}
    </article>
  );
}
