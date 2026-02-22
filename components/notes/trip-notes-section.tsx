"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { AddTripNoteDialog } from "@/components/notes/add-trip-note-dialog";

type LinkPreviewData = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  domain: string;
};

const previewCache = new Map<string, LinkPreviewData | "error">();

export type TripNote = {
  id: string;
  trip_id: string;
  title: string;
  content: unknown;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export interface TripNotesSectionProps {
  tripId: string;
}

const CARD_CLASS =
  "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

type ContentBlock =
  | { type: "text"; text?: string }
  | { type: "paragraph"; text?: string; content?: string }
  | { type: "list"; items?: string[] }
  | { type: "image"; url?: string; src?: string; path?: string; bucket?: string }
  | { type: "link"; url?: string; title?: string; href?: string };

function isBlockArray(content: unknown): content is ContentBlock[] {
  return Array.isArray(content) && content.every((x) => x && typeof x === "object" && "type" in x);
}

function getBlocks(content: unknown): ContentBlock[] | null {
  if (content == null) return null;
  if (isBlockArray(content)) return content;
  const obj = content as { blocks?: unknown };
  if (obj.blocks && Array.isArray(obj.blocks) && isBlockArray(obj.blocks))
    return obj.blocks;
  return null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 1) + "…";
}

function LinkPreviewBlock({ href }: { href: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const fetched = useRef(false);

  useEffect(() => {
    if (!href || fetched.current) return;
    const cached = previewCache.get(href);
    if (cached === "error") {
      setStatus("error");
      fetched.current = true;
      return;
    }
    if (cached) {
      setPreview(cached);
      setStatus("done");
      fetched.current = true;
      return;
    }
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: LinkPreviewData) => {
        if (cancelled) return;
        previewCache.set(href, data);
        setPreview(data);
        setStatus("done");
      })
      .catch(() => {
        if (!cancelled) {
          previewCache.set(href, "error");
          setStatus("error");
        }
      })
      .finally(() => {
        fetched.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  const domain = getDomain(href);
  const displayUrl = truncateUrl(href, 50);
  const fallback = (
    <>
      <span className="font-medium text-[#4A4A4A]">{domain}</span>
      <span className="mt-1 block truncate text-[#6B7280]">{displayUrl}</span>
    </>
  );

  if (status === "error" || status === "loading" || !preview) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-[#D4C5BA] bg-[#FAFAF8] p-3 text-start text-sm transition hover:bg-[#F5F3F0]"
      >
        {fallback}
      </a>
    );
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${preview.domain}&sz=48`;
  const thumb = preview.image ? (
    <img
      src={preview.image}
      alt=""
      className="size-12 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <img
      src={faviconUrl}
      alt=""
      className="size-12 shrink-0 rounded-lg bg-[#F5F3F0] object-contain"
    />
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg border border-[#D4C5BA] bg-[#FAFAF8] p-3 text-start text-sm transition hover:bg-[#F5F3F0]"
    >
      {thumb}
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[#4A4A4A]">
          {preview.title || preview.domain}
        </span>
        <span className="mt-0.5 block text-xs text-[#6B7280]">
          {preview.domain}
        </span>
      </div>
    </a>
  );
}

function NoteImageBlock({
  path,
  bucket,
}: {
  path: string;
  bucket: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setSrc(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  if (!src) return null;
  return (
    <div className="overflow-hidden rounded-lg">
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-64 w-full object-cover"
        />
      </a>
    </div>
  );
}

function NoteCardContent({ content }: { content: unknown }) {
  if (content == null) return null;
  if (typeof content === "string") {
    return <p className="text-start text-sm text-[#6B7280]">{content.trim() || null}</p>;
  }
  const blocks = getBlocks(content);
  if (!blocks || blocks.length === 0) {
    const obj = content as Record<string, unknown>;
    const text = (obj.text ?? obj.value ?? obj.content) as string | undefined;
    if (typeof text === "string") return <p className="text-start text-sm text-[#6B7280]">{text}</p>;
    return null;
  }
  return (
    <div className="mt-2 space-y-3 text-start">
      {blocks.map((block, i) => {
        if (!block || typeof block !== "object") return null;
        const b = block as ContentBlock & Record<string, unknown>;
        switch (b.type) {
          case "text":
          case "paragraph": {
            const text = (b.text ?? b.content) as string | undefined;
            if (typeof text !== "string") return null;
            return (
              <p
                key={i}
                className="whitespace-pre-line text-start text-sm text-[#6B7280]"
              >
                {text}
              </p>
            );
          }
          case "list": {
            const items = (b.items ?? []) as string[];
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <ul key={i} className="list-disc space-y-1 ps-4 text-start text-sm text-[#6B7280]">
                {items.map((item, j) => (
                  <li key={j}>{typeof item === "string" ? item : String(item)}</li>
                ))}
              </ul>
            );
          }
          case "image": {
            const path = (b as { path?: string }).path;
            const bucket = (b as { bucket?: string }).bucket;
            const url = (b.url ?? b.src) as string | undefined;
            if (path && bucket) {
              return (
                <NoteImageBlock
                  key={i}
                  path={path}
                  bucket={bucket}
                />
              );
            }
            if (!url) return null;
            return (
              <div key={i} className="overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="max-h-64 w-full rounded-lg object-cover"
                />
              </div>
            );
          }
          case "link": {
            const href = (b.url ?? b.href) as string | undefined;
            if (!href) return null;
            return <LinkPreviewBlock key={i} href={href} />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

function NoteCard({ note }: { note: TripNote }) {
  return (
    <article className={`${CARD_CLASS} text-start`}>
      <h3 className="text-base font-semibold text-[#4A4A4A]">{note.title}</h3>
      <NoteCardContent content={note.content} />
      {note.tags && note.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {note.tags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full bg-[#F5F3F0] px-2.5 py-0.5 text-xs text-[#6B7280]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function fetchNotes(tripId: string) {
  return supabase
    .from("trip_notes")
    .select("id, trip_id, title, content, tags, created_at, updated_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
}

export function TripNotesSection({ tripId }: TripNotesSectionProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    fetchNotes(tripId).then(({ data, error }) => {
      if (error) {
        console.error(error);
        setNotes([]);
      } else {
        setNotes((data ?? []) as TripNote[]);
      }
      setLoading(false);
    });
  }, [tripId]);

  async function refetchNotes() {
    if (!tripId) return;
    const { data, error } = await fetchNotes(tripId);
    if (!error) setNotes((data ?? []) as TripNote[]);
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-start">
          <h2 className="text-2xl font-bold text-[#4A4A4A]">Trip Notes</h2>
          <p className="mt-0.5 text-sm text-[#9B7B6B]">
            Your travel knowledge base
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F]"
          aria-label="Add note"
          onClick={() => setAddModalOpen(true)}
        >
          + Add Note
        </button>
      </div>

      <AddTripNoteDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        tripId={tripId}
        onSuccess={refetchNotes}
      />

      {loading ? (
        <p className="mt-6 text-start text-sm text-[#6B7280]">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#D4C5BA] py-8 text-start text-sm text-[#6B7280]">
          No notes yet. Start adding tips and insights for this trip.
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
