"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { LinkPreviewThumbnail } from "@/components/ui/link-preview-thumbnail";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  DASHBOARD_CARD_CONTENT_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  CARD_CONTENT_MT,
} from "@/components/trip/dashboard-card-styles";

export type TripNote = {
  id: string;
  trip_id: string;
  title: string;
  content: unknown;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
};

export interface TripNotesSummaryCardProps {
  tripId: string;
}
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

export function TripNotesSummaryCard({ tripId }: TripNotesSummaryCardProps) {
  const [total, setTotal] = useState(0);
  const [firstNote, setFirstNote] = useState<TripNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [thumbnailSignedUrl, setThumbnailSignedUrl] = useState<string | null>(null);
  const [linkFaviconError, setLinkFaviconError] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    Promise.all([
      supabase
        .from("trip_notes")
        .select("id, trip_id, title, content, tags, created_at, updated_at, sort_order")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true })
        .limit(1),
      supabase
        .from("trip_notes")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId),
    ]).then(([firstRes, countRes]) => {
      if (firstRes.error) {
        setFirstNote(null);
      } else {
        const list = (firstRes.data ?? []) as TripNote[];
        setFirstNote(list[0] ?? null);
      }
      setTotal(countRes.count ?? 0);
      setLoading(false);
    });
  }, [tripId]);

  const previewImage = firstNote ? getPreviewImage(firstNote.content) : null;
  const previewLinkUrl = firstNote ? getPreviewLinkUrl(firstNote.content) : null;
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

  const previewText = firstNote
    ? getPreviewFromBlocks(firstNote.content)
    : "";
  const showLinkPreview =
    !previewImage && previewLinkUrl && previewText.length > 0;

  return (
    <Link
      href={`/dashboard/trip/${tripId}/notes`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS} flex h-full flex-col`}
    >
      <div className={`${DASHBOARD_CARD_CONTENT_CLASS} flex min-h-0 flex-1 flex-col`}>
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-start">
          <h2 className={SECTION_TITLE_CLASS}>Trip Notes</h2>
          <p className={META_CLASS}>Your travel knowledge base</p>
        </div>
      </div>

      {loading ? (
        <p className={`${CARD_CONTENT_MT} text-start text-sm text-[#8a8a8a]`}>Loading…</p>
      ) : firstNote ? (
        <>
          <p className={`${CARD_CONTENT_MT} text-start text-sm font-medium text-[#2d2d2d]`}>
            {firstNote.title}
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
              <LinkPreviewThumbnail
                imageUrl={null}
                className="size-12 shrink-0"
              />
            )}
            <p className="min-w-0 flex-1 line-clamp-2 text-start text-sm text-[#8a8a8a]">
              {previewText || (previewImage ? "" : "No content")}
            </p>
          </div>
        </>
      ) : (
        <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
          <p className={EMPTY_STATE_TEXT_CLASS}>No notes yet</p>
        </div>
      )}

      <div className="mt-auto" aria-hidden />
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
