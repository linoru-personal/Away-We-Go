"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { LinkFavicon } from "@/components/ui/link-favicon";
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
  sort_order: number;
};

export interface TripNotesSectionProps {
  tripId: string;
  /** When false (e.g. viewer), hide add note and edit/delete on cards. Default true. */
  canEditContent?: boolean;
}

const CARD_CLASS =
  "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

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

function MoreVerticalIcon() {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

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
  const [imageError, setImageError] = useState(false);
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
    <div className="flex items-start gap-2">
      <LinkFavicon url={href} size={24} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-[#4A4A4A]">{domain}</span>
        <span className="mt-1 block truncate text-[#6B7280]">{displayUrl}</span>
      </div>
    </div>
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

  const showPreviewImage = preview.image && !imageError;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-[#D4C5BA] bg-[#FAFAF8] text-start text-sm transition hover:bg-[#F5F3F0]"
    >
      {showPreviewImage && (
        <div className="aspect-video max-h-48 w-full overflow-hidden rounded-t-lg bg-[#F5F3F0]">
          <img
            src={preview.image!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <LinkFavicon url={href} size={24} className="shrink-0" />
          <span className="min-w-0 truncate font-medium text-[#4A4A4A]">
            {preview.title || preview.domain}
          </span>
        </div>
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

function NoteCard({
  note,
  onEditRequest,
  onDeleteRequest,
  isDeleting,
}: {
  note: TripNote;
  onEditRequest?: (note: TripNote) => void;
  onDeleteRequest?: (noteId: string) => void;
  isDeleting?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const showMenu = onEditRequest || onDeleteRequest;

  return (
    <article className={`${CARD_CLASS} relative text-start`}>
      {showMenu && (
        <div className="absolute end-4 top-4" ref={menuRef}>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F5F3F0] hover:text-[#4A4A4A] disabled:opacity-50"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={isDeleting}
            aria-label="Note options"
            aria-expanded={menuOpen}
          >
            <MoreVerticalIcon />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-[#D4C5BA] bg-white py-1 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
              {onEditRequest && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-start text-sm text-[#4A4A4A] hover:bg-[#F5F3F0]"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditRequest(note);
                  }}
                >
                  Edit
                </button>
              )}
              {onDeleteRequest && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-start text-sm text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteRequest(note.id);
                  }}
                  disabled={isDeleting}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <h3 className="pe-10 text-base font-semibold text-[#4A4A4A]">{note.title}</h3>
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
    .select("id, trip_id, title, content, tags, created_at, updated_at, sort_order")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
}

export function TripNotesSection({ tripId, canEditContent = true }: TripNotesSectionProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TripNote | null>(null);
  const [confirmNoteId, setConfirmNoteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  function handleEditRequest(note: TripNote) {
    setEditingNote(note);
    setAddModalOpen(true);
  }

  function handleDeleteRequest(noteId: string) {
    setDeleteError(null);
    setConfirmNoteId(noteId);
  }

  async function handleDeleteConfirm() {
    if (!confirmNoteId) return;
    setDeletingId(confirmNoteId);
    setDeleteError(null);
    const { error } = await supabase
      .from("trip_notes")
      .delete()
      .eq("id", confirmNoteId);
    setDeletingId(null);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setConfirmNoteId(null);
    await refetchNotes();
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-start">
          <h2 className="text-2xl font-bold text-[#4A4A4A]">Trip Notes</h2>
          <p className="mt-0.5 text-sm text-[#9B7B6B]">
            {canEditContent ? "Your travel knowledge base" : "Read-only — you can view but not edit"}
          </p>
        </div>
        {canEditContent && (
        <button
          type="button"
          className="rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F]"
          aria-label="Add note"
          onClick={() => {
            setEditingNote(null);
            setAddModalOpen(true);
          }}
        >
          + Add Note
        </button>
        )}
      </div>

      <AddTripNoteDialog
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) setEditingNote(null);
        }}
        tripId={tripId}
        onSuccess={refetchNotes}
        initialNote={editingNote}
      />

      {loading ? (
        <p className="mt-6 text-start text-sm text-[#6B7280]">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#D4C5BA] py-8 text-start text-sm text-[#6B7280]">
          No notes yet. Start adding tips and insights for this trip.
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-5">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteCard
                  note={note}
                  onEditRequest={canEditContent ? handleEditRequest : undefined}
                  onDeleteRequest={canEditContent ? handleDeleteRequest : undefined}
                  isDeleting={deletingId === note.id}
                />
              </li>
            ))}
          </ul>

          {confirmNoteId && (
            <div
              className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
              aria-modal="true"
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-[24px] border border-[#D4C5BA] bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
                <h3 className="text-lg font-semibold text-[#4A4A4A]">
                  Delete this note?
                </h3>
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {deleteError}
                  </p>
                )}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                    onClick={() => {
                      setConfirmNoteId(null);
                      setDeleteError(null);
                    }}
                    disabled={!!deletingId}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#c46950] disabled:opacity-50"
                    onClick={handleDeleteConfirm}
                    disabled={!!deletingId}
                  >
                    {deletingId ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
