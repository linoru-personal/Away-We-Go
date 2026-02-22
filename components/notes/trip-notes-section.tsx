"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { AddTripNoteDialog } from "@/components/notes/add-trip-note-dialog";

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
  | { type: "image"; url?: string; src?: string }
  | { type: "link"; url?: string; title?: string; href?: string };

function isBlockArray(content: unknown): content is ContentBlock[] {
  return Array.isArray(content) && content.every((x) => x && typeof x === "object" && "type" in x);
}

function NoteCardContent({ content }: { content: unknown }) {
  if (content == null) return null;
  if (typeof content === "string") {
    return <p className="text-sm text-[#6B7280]">{content.trim() || null}</p>;
  }
  if (!isBlockArray(content)) {
    const obj = content as Record<string, unknown>;
    const text = (obj.text ?? obj.value ?? obj.content) as string | undefined;
    if (typeof text === "string") return <p className="text-sm text-[#6B7280]">{text}</p>;
    return null;
  }
  return (
    <div className="mt-2 space-y-3">
      {content.map((block, i) => {
        if (!block || typeof block !== "object") return null;
        const b = block as ContentBlock & Record<string, unknown>;
        switch (b.type) {
          case "text":
          case "paragraph": {
            const text = (b.text ?? b.content) as string | undefined;
            if (typeof text !== "string") return null;
            return (
              <p key={i} className="text-sm text-[#6B7280]">
                {text}
              </p>
            );
          }
          case "list": {
            const items = (b.items ?? []) as string[];
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <ul key={i} className="list-disc space-y-1 pl-4 text-sm text-[#6B7280]">
                {items.map((item, j) => (
                  <li key={j}>{typeof item === "string" ? item : String(item)}</li>
                ))}
              </ul>
            );
          }
          case "image": {
            const url = (b.url ?? b.src) as string | undefined;
            if (!url) return null;
            return (
              <div key={i} className="overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="max-h-48 w-full object-cover"
                />
              </div>
            );
          }
          case "link": {
            const href = (b.url ?? b.href) as string | undefined;
            const title = (b.title ?? href) as string | undefined;
            if (!href) return null;
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-[#D4C5BA] bg-[#FAFAF8] p-3 text-sm text-[#4A4A4A] transition hover:bg-[#F5F3F0]"
              >
                <span className="font-medium">{title || href}</span>
                <span className="ml-1 text-[#6B7280]">{href}</span>
              </a>
            );
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
    <article className={CARD_CLASS}>
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
        <div className="min-w-0 flex-1">
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
        <p className="mt-6 text-sm text-[#6B7280]">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#D4C5BA] py-8 text-center text-sm text-[#6B7280]">
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
