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
  src?: string;
};

function isBlockArray(value: unknown): value is ContentBlock[] {
  return (
    Array.isArray(value) &&
    value.every((x) => x != null && typeof x === "object" && "type" in x)
  );
}

function normalizeContent(content: unknown): unknown {
  if (content == null) return null;
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      return content;
    }
  }
  return content;
}

function getBlocks(content: unknown): ContentBlock[] {
  const normalized = normalizeContent(content);
  if (normalized == null) return [];
  if (isBlockArray(normalized)) return normalized;
  const obj = normalized as { blocks?: unknown };
  if (obj.blocks != null && isBlockArray(obj.blocks)) return obj.blocks;
  return [];
}

function isImageBlock(b: ContentBlock): boolean {
  const type = typeof b.type === "string" ? b.type.toLowerCase() : "";
  return type === "image";
}

function getImagePathOrUrl(
  b: ContentBlock
): { path: string; bucket: string } | { directUrl: string } | null {
  const path = b.path ?? (b as Record<string, unknown>).path;
  if (path && typeof path === "string") {
    const bucket =
      (b.bucket ?? (b as Record<string, unknown>).bucket) ?? TRIP_NOTES_BUCKET;
    return {
      path,
      bucket: typeof bucket === "string" ? bucket : TRIP_NOTES_BUCKET,
    };
  }
  const url =
    b.url ??
    b.src ??
    (b as Record<string, unknown>).url ??
    (b as Record<string, unknown>).src;
  if (url && typeof url === "string") return { directUrl: url };
  return null;
}

function getPreviewImage(
  content: unknown
): { path: string; bucket: string } | { directUrl: string } | null {
  const blocks = getBlocks(content);
  const imageBlock = blocks.find(
    (b) =>
      isImageBlock(b) &&
      (b.path || b.url || b.src || (b as Record<string, unknown>).path)
  );
  if (!imageBlock) return null;
  return getImagePathOrUrl(imageBlock);
}

/** First link block URL for favicon/domain, or null. */
function getPreviewLinkUrl(content: unknown): string | null {
  const blocks = getBlocks(content);
  const linkBlock = blocks.find(
    (b) =>
      (b.type === "link" || (b as ContentBlock & { type?: string }).type?.toLowerCase() === "link") &&
      (b.url ?? (b as Record<string, unknown>).href)
  );
  const url = linkBlock?.url ?? (linkBlock as Record<string, unknown>)?.href;
  return url && typeof url === "string" ? url : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Build preview string from note content blocks (image → link → list → text). ~2 lines max. */
function getPreviewFromBlocks(content: unknown): string {
  const blocks = getBlocks(content);
  if (blocks.length === 0) return "";

  const imageBlock = blocks.find(isImageBlock);
  if (imageBlock) return "";

  const linkBlock = blocks.find((b) => b.type === "link" && b.url);
  if (linkBlock && linkBlock.url) {
    const title = linkBlock.title?.trim();
    if (title) return title;
    try {
      return getDomain(linkBlock.url);
    } catch {
      return linkBlock.url.slice(0, 50);
    }
  }

  const listBlock = blocks.find(
    (b) =>
      b.type === "list" &&
      Array.isArray(b.items) &&
      b.items.length > 0
  );
  if (listBlock && listBlock.items) {
    const items = listBlock.items
      .slice(0, 2)
      .map((i) => (typeof i === "string" ? i : String(i)));
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

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 text-[#6B7280]"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function TripNotesSummaryCard({ tripId }: TripNotesSummaryCardProps) {
  const router = useRouter();
  const [total, setTotal] = useState(0);
  const [latestNote, setLatestNote] = useState<TripNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [thumbnailSignedUrl, setThumbnailSignedUrl] = useState<string | null>(null);
  const [linkFaviconError, setLinkFaviconError] = useState(false);

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

  const previewImage = latestNote ? getPreviewImage(latestNote.content) : null;
  const previewLinkUrl = latestNote ? getPreviewLinkUrl(latestNote.content) : null;
  const needsSignedUrl =
    previewImage != null && "path" in previewImage && previewImage.path;
  const pathForSign =
    needsSignedUrl && previewImage && "path" in previewImage
      ? previewImage.path
      : null;
  const bucketForSign =
    needsSignedUrl && previewImage && "bucket" in previewImage
      ? previewImage.bucket
      : null;

  useEffect(() => {
    setLinkFaviconError(false);
  }, [previewLinkUrl]);

  useEffect(() => {
    if (pathForSign == null || bucketForSign == null) {
      setThumbnailSignedUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(bucketForSign)
      .createSignedUrl(pathForSign, 3600)
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
  }, [pathForSign, bucketForSign]);

  const thumbnailSrc =
    thumbnailSignedUrl ??
    (previewImage && "directUrl" in previewImage ? previewImage.directUrl : null);

  const previewText = latestNote
    ? getPreviewFromBlocks(latestNote.content)
    : "";
  const showLinkPreview =
    !previewImage && previewLinkUrl && previewText.length > 0;
  const linkDomain = previewLinkUrl ? getDomain(previewLinkUrl) : "";
  const linkFaviconSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(linkDomain)}&sz=64`;

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
            {previewImage &&
              (thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt=""
                  className="size-12 shrink-0 rounded object-cover"
                />
              ) : (
                <div
                  className="size-12 shrink-0 rounded bg-[#F5F3F0] object-cover"
                  aria-hidden
                />
              ))}
            {showLinkPreview && (
              <div className="size-12 shrink-0 flex items-center justify-center rounded bg-[#F5F3F0] overflow-hidden">
                {linkFaviconError ? (
                  <LinkIcon />
                ) : (
                  <img
                    src={linkFaviconSrc}
                    alt=""
                    className="size-12 rounded object-contain"
                    onError={() => setLinkFaviconError(true)}
                  />
                )}
              </div>
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
