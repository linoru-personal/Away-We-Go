"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Trip Assistant — AI place suggestions backed by `POST /api/agent`.
 *
 * INTENTIONALLY NOT RENDERED. This was extracted out of
 * `app/dashboard/trip/[id]/page.tsx`, where it sat between
 * `TripDashboardSummaryStrip` and the card grid, and removed from the UI pending
 * a rework. The backend (`app/api/agent/route.ts` -> `src/lib/agent/runAgent`)
 * is still live and unchanged.
 *
 * To put it back, mount it in that same spot:
 *   <TripAssistant tripId={trip.id} destination={trip.destination} />
 *
 * Two things were knowingly carried over unfinished and should be settled during
 * the rework:
 *   - the card's "Add to trip notes" button is a no-op
 *   - `childrenAges` is hardcoded to [4, 5], and destination falls back to "Munich"
 */

export interface TripAssistantProps {
  tripId: string;
  destination?: string | null;
}

type AssistantResponse = {
  message: string;
  cards?: {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    actionLabel?: string;
  }[];
  followups?: string[];
};

const SUGGESTED_PROMPTS = [
  "Family-friendly places",
  "Parks for kids age 4-5",
  "Indoor places",
  "Playgrounds",
];

export function TripAssistant({ tripId, destination }: TripAssistantProps) {
  const [assistantInput, setAssistantInput] = useState(
    "Which parks in Munich are good for kids age 4-5?"
  );
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantResponse, setAssistantResponse] =
    useState<AssistantResponse | null>(null);

  const clearAssistant = () => {
    setAssistantInput("");
    setAssistantResponse(null);
    setAssistantError(null);
    setAssistantLoading(false);
  };

  const handleAssistantSubmit = async () => {
    if (!tripId || !assistantInput.trim()) return;
    setAssistantError(null);
    setAssistantResponse(null);
    setAssistantLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: assistantInput.trim(),
          tripId,
          destination: destination ?? "Munich",
          childrenAges: [4, 5],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAssistantError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setAssistantResponse(data);
    } catch {
      setAssistantError("Something went wrong. Please try again.");
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <section
      className="mt-8 rounded-xl border border-[#ebe5df]/60 bg-white/50 py-4 px-4 md:px-5"
      aria-labelledby="trip-assistant-title"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#8a8a8a]" aria-hidden />
          <h2
            id="trip-assistant-title"
            className="text-sm font-medium text-[#4A4A4A]"
          >
            Trip Assistant
          </h2>
        </div>
        {(assistantResponse != null ||
          assistantError != null ||
          assistantLoading) && (
          <button
            type="button"
            onClick={clearAssistant}
            className="shrink-0 text-[11px] text-[#8a8a8a] transition hover:text-[#4A4A4A] focus:outline-none focus:ring-0"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[#9a9a9a]">
        Find places and ideas for this trip
      </p>
      <div className="mt-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-[#e0d9d2]/60 bg-[#fbf7f2]/60 px-3 py-2 focus-within:border-[#d97b5e]/40 focus-within:ring-1 focus-within:ring-[#d97b5e]/15">
          <label htmlFor="trip-assistant-input" className="sr-only">
            Ask for places
          </label>
          <input
            id="trip-assistant-input"
            type="text"
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAssistantSubmit();
              }
            }}
            disabled={assistantLoading}
            placeholder="e.g. Which parks are good for kids?"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#1f1f1f] placeholder:text-[#9a9a9a] focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAssistantSubmit}
            disabled={assistantLoading || !assistantInput.trim()}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-[#6b6b6b] transition hover:bg-[#ebe5df]/50 hover:text-[#2d2d2d] focus:outline-none focus:ring-1 focus:ring-[#d97b5e]/20 disabled:opacity-50"
          >
            {assistantLoading ? "…" : "Ask"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#9a9a9a]">Try asking:</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {SUGGESTED_PROMPTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setAssistantInput(label)}
              disabled={assistantLoading}
              className="rounded-md px-2 py-0.5 text-[11px] text-[#8a8a8a] transition hover:bg-[#ebe5df]/40 hover:text-[#4A4A4A] focus:outline-none disabled:opacity-60"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Response area */}
      <div className="mt-6 pt-4 border-t border-[#ebe5df]/40">
        {assistantLoading && (
          <p className="text-xs text-[#9a9a9a]">Looking for places…</p>
        )}
        {!assistantLoading && assistantError && (
          <p className="text-xs text-red-600" role="alert">
            {assistantError}
          </p>
        )}
        {!assistantLoading && assistantResponse && (
          <div className="space-y-3">
            <p className="text-sm text-[#4A4A4A] leading-relaxed">
              {assistantResponse.message}
            </p>
            {assistantResponse.cards && assistantResponse.cards.length > 0 && (
              <ul className="grid gap-2.5 sm:grid-cols-2" role="list">
                {assistantResponse.cards.map((card) => (
                  <li
                    key={card.id}
                    className="rounded-lg border border-[#ebe5df]/60 bg-[#fbf7f2]/60 p-3"
                  >
                    <h3 className="text-sm font-semibold text-[#1f1f1f]">
                      {card.title}
                    </h3>
                    {card.subtitle && (
                      <p className="mt-0.5 text-xs text-[#8a8a8a]">
                        {card.subtitle}
                      </p>
                    )}
                    {card.description && (
                      <p className="mt-1.5 text-xs text-[#4A4A4A] line-clamp-3 leading-relaxed">
                        {card.description}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-2.5 rounded-md bg-[#d97b5e]/85 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#d97b5e] focus:outline-none focus:ring-1 focus:ring-[#d97b5e] focus:ring-offset-1 focus:ring-offset-[#fbf7f2]"
                      onClick={() => {}}
                    >
                      {card.actionLabel ?? "Add to trip notes"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
