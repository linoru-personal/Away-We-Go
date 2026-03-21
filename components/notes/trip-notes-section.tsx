"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { LinkPreviewThumbnail } from "@/components/ui/link-preview-thumbnail";
import { GroupedSortableList } from "@/components/ui/grouped-sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";
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

/** Hebrew Unicode range (letters and marks). Returns true if the first character is Hebrew. */
function startsWithHebrew(s: string): boolean {
  const trimmed = (s ?? "").trim();
  if (trimmed.length === 0) return false;
  const code = trimmed.charCodeAt(0);
  return (code >= 0x0590 && code <= 0x05ff) || (code >= 0xfb1d && code <= 0xfb4f);
}

/** Compact link preview: og:image thumb when valid; otherwise neutral link icon placeholder. */
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
  const title = preview?.title || preview?.domain || domain;
  const description = preview?.description?.trim();
  const maxDescLen = 120;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      className="block rounded-lg border border-[#D4C5BA] bg-[#FAFAF8] p-3 text-left text-sm transition hover:bg-[#F5F3F0]"
    >
      <div className="flex items-start gap-3">
        <LinkPreviewThumbnail
          imageUrl={status === "done" ? preview?.image : null}
          apiLoading={status === "loading"}
          className="mt-0.5 h-20 w-20"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-[#9B7B6B]">
            {domain}
          </span>
          <span className="block font-medium text-[#4A4A4A] line-clamp-2">
            {status === "loading" ? "…" : title}
          </span>
          {description && description.length > 0 && (
            <span className="block text-[#6B7280] line-clamp-2">
              {description.length > maxDescLen
                ? description.slice(0, maxDescLen) + "…"
                : description}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

const NOTE_IMAGE_THUMB_CLASS =
  "max-h-32 w-full max-w-[200px] rounded-lg object-cover sm:max-h-36 sm:max-w-[220px]";
const NOTE_IMAGE_GRID_CLASS = "h-full w-full rounded-lg object-cover";
/** Grid cells: fixed height thumbs (avoid full-width aspect-square, which dominates the card). */
const NOTE_IMAGE_GRID_CELL_CLASS =
  "h-24 w-full overflow-hidden rounded-lg sm:h-28 md:h-32";

function NoteImageBlock({
  path,
  bucket,
  onImageClick,
  grid,
}: {
  path: string;
  bucket: string;
  onImageClick?: (url: string) => void;
  /** When true, render as a cell in the image grid (aspect-square, fill). */
  grid?: boolean;
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

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt="Note image"
      className={grid ? NOTE_IMAGE_GRID_CLASS : NOTE_IMAGE_THUMB_CLASS}
    />
  );

  if (onImageClick) {
    return (
      <button
        type="button"
        onClick={() => onImageClick(src)}
        className={
          grid
            ? `${NOTE_IMAGE_GRID_CELL_CLASS} text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1`
            : "overflow-hidden rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1"
        }
        aria-label="View image full size"
      >
        {img}
      </button>
    );
  }

  return (
    <div
      className={
        grid ? "aspect-square w-full overflow-hidden rounded-lg" : "overflow-hidden rounded-lg"
      }
    >
      <a href={src} target="_blank" rel="noopener noreferrer" className="block size-full">
        {img}
      </a>
    </div>
  );
}

/** Renders a single image block as a grid thumbnail (storage or URL). */
function NoteImageThumbnail({
  blockKey,
  path,
  bucket,
  url,
  onImageClick,
}: {
  blockKey: string;
  path?: string;
  bucket?: string;
  url?: string;
  onImageClick?: (url: string) => void;
}) {
  if (path && bucket) {
    return (
      <NoteImageBlock
        key={blockKey}
        path={path}
        bucket={bucket}
        onImageClick={onImageClick}
        grid
      />
    );
  }
  if (!url) return null;
  const thumb = (
    <img
      src={url}
      alt="Note image"
      className="h-full w-full rounded-lg object-cover"
    />
  );
  if (onImageClick) {
    return (
      <button
        key={blockKey}
        type="button"
        onClick={() => onImageClick(url)}
        className={`${NOTE_IMAGE_GRID_CELL_CLASS} text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1`}
        aria-label="View image full size"
      >
        {thumb}
      </button>
    );
  }
  return (
    <div key={blockKey} className={NOTE_IMAGE_GRID_CELL_CLASS}>
      {thumb}
    </div>
  );
}

function NoteCardContent({
  content,
  onImageClick,
}: {
  content: unknown;
  onImageClick?: (url: string) => void;
}) {
  if (content == null) return null;
  if (typeof content === "string") {
    return <p className="mt-2 text-start text-sm text-[#6B7280]">{content.trim() || null}</p>;
  }
  const blocks = getBlocks(content);
  if (!blocks || blocks.length === 0) {
    const obj = content as Record<string, unknown>;
    const text = (obj.text ?? obj.value ?? obj.content) as string | undefined;
    if (typeof text === "string") return <p className="mt-2 text-start text-sm text-[#6B7280]">{text}</p>;
    return null;
  }

  const textBlocks: React.ReactNode[] = [];
  const linkBlocks: React.ReactNode[] = [];
  const imageBlocks: { key: string; path?: string; bucket?: string; url?: string }[] = [];

  blocks.forEach((block, i) => {
    if (!block || typeof block !== "object") return;
    const b = block as ContentBlock & Record<string, unknown>;
    const key = `block-${i}`;
    switch (b.type) {
      case "text":
      case "paragraph": {
        const text = (b.text ?? b.content) as string | undefined;
        if (typeof text !== "string") return;
        textBlocks.push(
          <p key={key} className="whitespace-pre-line text-start text-sm text-[#6B7280]">
            {text}
          </p>
        );
        break;
      }
      case "list": {
        const items = (b.items ?? []) as string[];
        if (!Array.isArray(items) || items.length === 0) return;
        textBlocks.push(
          <ul key={key} className="list-disc space-y-1 ps-4 text-start text-sm text-[#6B7280] marker:text-[#E07A5F]">
            {items.map((item, j) => (
              <li key={j}>{typeof item === "string" ? item : String(item)}</li>
            ))}
          </ul>
        );
        break;
      }
      case "image": {
        const path = (b as { path?: string }).path;
        const bucket = (b as { bucket?: string }).bucket;
        const url = (b.url ?? b.src) as string | undefined;
        if (path && bucket) imageBlocks.push({ key, path, bucket });
        else if (url) imageBlocks.push({ key, url });
        break;
      }
      case "link": {
        const href = (b.url ?? b.href) as string | undefined;
        if (!href) return;
        linkBlocks.push(<LinkPreviewBlock key={key} href={href} />);
        break;
      }
      default:
        break;
    }
  });

  const hasText = textBlocks.length > 0;
  const hasLinks = linkBlocks.length > 0;
  const hasImages = imageBlocks.length > 0;

  return (
    <div className="mt-2 space-y-4 text-start">
      {hasText && <div className="space-y-3">{textBlocks}</div>}
      {hasLinks && (
        <div className="space-y-2">
          {linkBlocks}
        </div>
      )}
      {hasImages && (
        <div
          className={`grid gap-1.5 sm:gap-2 ${
            imageBlocks.length === 1
              ? "grid-cols-1 max-w-[180px] sm:max-w-[200px]"
              : "grid-cols-2 max-w-[240px] sm:max-w-[280px]"
          }`}
        >
          {imageBlocks.map((img) => (
            <NoteImageThumbnail
              key={img.key}
              blockKey={img.key}
              path={img.path}
              bucket={img.bucket}
              url={img.url}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onEditRequest,
  onDeleteRequest,
  onImageClick,
  isDeleting,
}: {
  note: TripNote;
  onEditRequest?: (note: TripNote) => void;
  onDeleteRequest?: (noteId: string) => void;
  onImageClick?: (url: string) => void;
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
  const isRtl = startsWithHebrew(note.title ?? "");

  return (
    <article
      className={`${CARD_CLASS} relative text-start`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {showMenu && (
        <div
          className="absolute end-4 top-4"
          ref={menuRef}
          onPointerDown={(e) => e.stopPropagation()}
        >
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
      <NoteCardContent content={note.content} onImageClick={onImageClick} />
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

/** Sentinel group for notes with no tags (droppable even when empty). */
const NOTE_UNTAGGED_KEY = "__untagged__";

/** Primary section = alphabetically first tag, or untagged if none. */
function getNotePrimaryGroupKey(note: TripNote): string {
  const tags = note.tags?.filter((t) => t.trim()) ?? [];
  if (tags.length === 0) return NOTE_UNTAGGED_KEY;
  const sorted = [...tags].sort((a, b) => a.localeCompare(b));
  return sorted[0] ?? NOTE_UNTAGGED_KEY;
}

function tagsForMoveToGroup(note: TripNote, toGroupKey: string): string[] | null {
  if (toGroupKey === NOTE_UNTAGGED_KEY) return null;
  const rest = (note.tags ?? []).filter((t) => t !== toGroupKey);
  return [toGroupKey, ...rest];
}

function buildNoteGroups(notes: TripNote[]): { groupKey: string; items: TripNote[] }[] {
  const byKey = new Map<string, TripNote[]>();
  for (const n of notes) {
    const k = getNotePrimaryGroupKey(n);
    const list = byKey.get(k) ?? [];
    list.push(n);
    byKey.set(k, list);
  }
  if (!byKey.has(NOTE_UNTAGGED_KEY)) {
    byKey.set(NOTE_UNTAGGED_KEY, []);
  }
  const keys = Array.from(byKey.keys()).sort((a, b) => {
    if (a === NOTE_UNTAGGED_KEY) return 1;
    if (b === NOTE_UNTAGGED_KEY) return -1;
    return a.localeCompare(b);
  });
  return keys.map((groupKey) => ({
    groupKey,
    items: (byKey.get(groupKey) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
    ),
  }));
}

function ImageLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#4A4A4A] shadow transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/50"
        aria-label="Close image"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function TripNotesSection({ tripId, canEditContent = true }: TripNotesSectionProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TripNote | null>(null);
  const [confirmNoteId, setConfirmNoteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  const noteGroups = useMemo(() => buildNoteGroups(notes), [notes]);

  const noteGroupKeysInOrder = useMemo(
    () => noteGroups.map((g) => g.groupKey),
    [noteGroups]
  );

  const handleNotesReorder = useCallback(
    async (_groupKey: string, newOrderedItems: TripNote[]) => {
      if (newOrderedItems.length === 0) return;
      const minOrder = Math.min(...newOrderedItems.map((n) => n.sort_order));
      const updated = newOrderedItems.map((note, i) => ({
        ...note,
        sort_order: minOrder + i,
      }));
      setNotes((prev) => {
        const ids = new Set(updated.map((n) => n.id));
        const rest = prev.filter((n) => !ids.has(n.id));
        return [...rest, ...updated].sort((a, b) => a.sort_order - b.sort_order);
      });
      await Promise.all(
        updated.map((note) =>
          supabase.from("trip_notes").update({ sort_order: note.sort_order }).eq("id", note.id)
        )
      );
    },
    []
  );

  const handleNotesMove = useCallback(
    async (item: TripNote, fromGroupKey: string, toGroupKey: string, insertIndex: number) => {
      const getKey = getNotePrimaryGroupKey;
      const sourceItems = notes.filter((n) => getKey(n) === fromGroupKey && n.id !== item.id);
      const destItems = notes.filter((n) => getKey(n) === toGroupKey);
      const newTags = tagsForMoveToGroup(item, toGroupKey);
      const movedItem: TripNote = { ...item, tags: newTags };
      const newDestItems = [
        ...destItems.slice(0, insertIndex),
        movedItem,
        ...destItems.slice(insertIndex),
      ];

      const itemsByKey = new Map<string, TripNote[]>();
      for (const key of noteGroupKeysInOrder) {
        if (key === fromGroupKey) itemsByKey.set(key, sourceItems);
        else if (key === toGroupKey) itemsByKey.set(key, newDestItems);
        else itemsByKey.set(key, notes.filter((n) => getKey(n) === key));
      }

      const flat: TripNote[] = [];
      for (const key of noteGroupKeysInOrder) {
        const list = itemsByKey.get(key) ?? [];
        for (let i = 0; i < list.length; i++) {
          flat.push({ ...list[i], sort_order: flat.length });
        }
      }

      setNotes(flat);

      await Promise.all(
        flat.map((note) =>
          supabase
            .from("trip_notes")
            .update({ sort_order: note.sort_order, tags: note.tags })
            .eq("id", note.id)
        )
      );
    },
    [notes, noteGroupKeysInOrder]
  );

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
      ) : canEditContent ? (
        <>
          <div className="mt-6">
            <GroupedSortableList<TripNote>
              groups={noteGroups}
              groupingMeta={{
                field: "tags",
                groupKeyToFieldValue: () => null,
              }}
              onReorder={handleNotesReorder}
              onMove={handleNotesMove}
              disabled={false}
              listTag="ul"
              listClassName="space-y-5 list-none"
              renderGroupHeader={(groupKey) => (
                <div className="mb-3">
                  {groupKey === NOTE_UNTAGGED_KEY ? (
                    <span className="text-base font-semibold text-[#4A4A4A]">Untagged</span>
                  ) : (
                    <span className="inline-block rounded-full bg-[#F5F3F0] px-3 py-1 text-sm font-semibold text-[#4A4A4A]">
                      {groupKey}
                    </span>
                  )}
                </div>
              )}
              renderItem={(note, { setNodeRef, style, attributes, listeners, isDragging }) => (
                <li
                  ref={setNodeRef}
                  style={style}
                  className="group relative rounded-[24px] transition-shadow duration-150 list-none"
                >
                  <div
                    className={`relative ps-10 rounded-[24px] transition-all duration-150 ${isDragging ? "shadow-lg scale-[1.01]" : ""}`}
                  >
                    <span className="absolute start-4 top-4 z-[1] transition-opacity">
                      <DragHandle
                        listeners={listeners}
                        attributes={attributes}
                        aria-label="Drag to reorder note"
                      />
                    </span>
                    <NoteCard
                      note={note}
                      onEditRequest={handleEditRequest}
                      onDeleteRequest={handleDeleteRequest}
                      onImageClick={setLightboxUrl}
                      isDeleting={deletingId === note.id}
                    />
                  </div>
                </li>
              )}
            />
          </div>

          {lightboxUrl && (
            <ImageLightbox
              src={lightboxUrl}
              onClose={() => setLightboxUrl(null)}
            />
          )}

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
      ) : (
        <>
          <div className="mt-6 space-y-10">
            {noteGroups.map((group) => (
              <section key={group.groupKey}>
                <div className="mb-3">
                  {group.groupKey === NOTE_UNTAGGED_KEY ? (
                    <span className="text-base font-semibold text-[#4A4A4A]">Untagged</span>
                  ) : (
                    <span className="inline-block rounded-full bg-[#F5F3F0] px-3 py-1 text-sm font-semibold text-[#4A4A4A]">
                      {group.groupKey}
                    </span>
                  )}
                </div>
                <ul className="space-y-5 list-none">
                  {group.items.map((note) => (
                    <li key={note.id}>
                      <NoteCard
                        note={note}
                        onEditRequest={undefined}
                        onDeleteRequest={undefined}
                        onImageClick={setLightboxUrl}
                        isDeleting={false}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {lightboxUrl && (
            <ImageLightbox
              src={lightboxUrl}
              onClose={() => setLightboxUrl(null)}
            />
          )}

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
