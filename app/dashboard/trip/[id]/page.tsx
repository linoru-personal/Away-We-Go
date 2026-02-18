"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import TripHero from "@/components/trip/trip-hero";
import { TasksSummaryCard } from "@/components/tasks/tasks-summary-card";

const CARD_CLASS =
  "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  created_at: string | null;
};

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? "—";
}

function MoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
    >
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  );
}

export default function TripPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, loading: sessionLoading } = useSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleSuccess, setTitleSuccess] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user || !id) {
      if (!id) setTitleError("Missing trip id.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setTitleError(null);

      const { data, error: fetchError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (fetchError || !data) {
        setTitleError(
          fetchError?.message ?? "Trip not found (or you don't have access)."
        );
        setTrip(null);
      } else {
        setTrip(data as Trip);
        setTitle((data as Trip).title);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function saveTitle() {
    if (!trip) return;

    const next = title.trim();
    if (!next) {
      setTitleError("Title cannot be empty.");
      return;
    }

    setTitleError(null);
    setTitleSuccess(false);
    setIsSaving(true);

    supabase
      .from("trips")
      .update({ title: next })
      .eq("id", trip.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          setTitleError(updateError.message);
          setIsSaving(false);
          return;
        }
        setTrip((prev) => (prev ? { ...prev, title: next } : prev));
        setTitleSuccess(true);
        setIsEditingTitle(false);
        setIsSaving(false);
        setTimeout(() => setTitleSuccess(false), 2000);
      });
  }

  function cancelEditTitle() {
    setTitle(trip?.title ?? "");
    setTitleError(null);
    setIsEditingTitle(false);
  }

  function deleteTrip() {
    if (!trip) return;

    setTitleError(null);
    setIsDeleting(true);

    supabase
      .from("trips")
      .delete()
      .eq("id", trip.id)
      .then(({ error: deleteError }) => {
        if (deleteError) {
          setTitleError(deleteError.message);
          setIsDeleting(false);
          return;
        }
        router.replace("/dashboard");
      });
  }

  if (sessionLoading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-[#6B7280]">
        Loading...
      </p>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        {loading ? (
          <p className="text-[#6B7280]">Loading...</p>
        ) : !trip ? (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#4A4A4A]">Trip</h1>
            <p className="text-[#6B7280]">Trip id: {id ?? "—"}</p>
            {titleError && (
              <p className="text-sm text-red-600">{titleError}</p>
            )}
          </div>
        ) : (
          <>
            <div>
              <TripHero
                title={trip.title}
                dates={formatDates(trip.start_date, trip.end_date)}
                imageUrl={trip.cover_image_url ?? undefined}
                onBack={() => router.push("/dashboard")}
                topRight={
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30"
                      aria-label="Menu"
                      onClick={() => setMenuOpen((o) => !o)}
                    >
                      <MoreIcon />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[#D4C5BA] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm text-[#4A4A4A] hover:bg-[#F5F3F0]"
                          onClick={() => {
                            setMenuOpen(false);
                            setIsEditingTitle(true);
                          }}
                        >
                          Edit title
                        </button>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setMenuOpen(false);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          Delete trip
                        </button>
                      </div>
                    )}
                  </div>
                }
                titleContent={
                  isEditingTitle ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="max-w-full rounded-lg border border-white/50 bg-white/20 px-3 py-2 text-lg font-bold text-white placeholder:text-white/70 backdrop-blur-sm sm:text-xl"
                          placeholder="Trip title"
                          disabled={isSaving}
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-white/30 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/40 disabled:opacity-50"
                          onClick={saveTitle}
                          disabled={isSaving || !title.trim()}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/30"
                          onClick={cancelEditTitle}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                      </div>
                      {titleError && (
                        <p className="text-sm text-red-200">{titleError}</p>
                      )}
                    </div>
                  ) : undefined
                }
                onEditTitle={
                  !isEditingTitle ? () => setIsEditingTitle(true) : undefined
                }
              />
              {titleSuccess && (
                <p className="mt-2 text-sm text-[#E07A5F]">Title saved.</p>
              )}
            </div>

            <div className="mt-8 space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Destination */}
                <article className={CARD_CLASS}>
                  <h2 className="text-lg font-semibold text-[#4A4A4A]">
                    Destination
                  </h2>
                  <p className="mt-0.5 text-sm text-[#9B7B6B]">
                    {trip.destination ?? "—"}
                  </p>
                </article>

                {/* Tasks summary */}
                <TasksSummaryCard tripId={trip.id} />

                {/* Packing */}
                <article className={CARD_CLASS}>
                  <h2 className="text-lg font-semibold text-[#4A4A4A]">
                    Packing
                  </h2>
                  <p className="mt-0.5 text-sm text-[#9B7B6B]">
                    List progress
                  </p>
                  <p className="mt-4 text-2xl font-semibold text-[#E07A5F]">
                    0%
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F5F3F0]">
                    <div
                      className="h-full rounded-full bg-[#E07A5F] transition-all duration-500"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <ul className="mt-4 space-y-3">
                    {["Item one", "Item two"].map((label, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-[#D4C5BA] bg-white" />
                        <span className="text-sm text-[#6B7280]">{label}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                {/* Budget */}
                <article className={CARD_CLASS}>
                  <h2 className="text-lg font-semibold text-[#4A4A4A]">
                    Budget
                  </h2>
                  <p className="mt-0.5 text-sm text-[#9B7B6B]">
                    Planned vs spent
                  </p>
                  <div className="mt-4 flex justify-between text-sm">
                    <span className="text-[#6B7280]">Planned</span>
                    <span className="font-medium text-[#4A4A4A]">$0</span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-[#6B7280]">Spent</span>
                    <span className="font-medium text-[#4A4A4A]">$0</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F5F3F0]">
                    <div
                      className="h-full rounded-full bg-[#E07A5F] transition-all duration-500"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#9B7B6B]">
                    Remaining: $0
                  </p>
                </article>

                {/* Photos */}
                <article className={`${CARD_CLASS} md:col-span-2`}>
                  <h2 className="text-lg font-semibold text-[#4A4A4A]">
                    Photos
                  </h2>
                  <p className="mt-0.5 text-sm text-[#9B7B6B]">0 photos</p>
                  <div className="mt-4 grid grid-cols-2 gap-1">
                    <div className="aspect-square rounded-lg bg-[#F5F3F0]" />
                    <div className="aspect-square rounded-lg bg-[#F5F3F0]" />
                  </div>
                </article>
              </div>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-[24px] border border-[#D4C5BA] bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
            <h3 className="text-lg font-semibold text-[#4A4A4A]">
              Delete this trip?
            </h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#c46950] disabled:opacity-50"
                onClick={() => deleteTrip()}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
