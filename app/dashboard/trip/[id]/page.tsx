"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import TripHero from "@/components/trip/trip-hero";
import { TasksSummaryCard } from "@/components/tasks/tasks-summary-card";
import { TripNotesSummaryCard } from "@/components/notes/trip-notes-summary-card";
import { PackingSummaryCard } from "@/components/packing/packing-summary-card";
import { BudgetSummaryCard } from "@/components/budget/budget-summary-card";
import { PhotosSummaryCard } from "@/components/trips/photos/photos-summary-card";
import TripFormModal from "@/components/trips/trip-form-modal";
import { TripDashboardSummaryStrip } from "@/components/trip/trip-dashboard-summary-strip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  DESTINATION_PLACEHOLDER_CLASS,
} from "@/components/trip/dashboard-card-styles";

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-8 text-[#8a8a8a]"}
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  destination_image_url: string | null;
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

function Share2Icon() {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="M15.41 6.51l-6.82 3.98" />
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
  const { canManageSharing, canEditMetadata, canDeleteTrip, role: tripRole } = useTripRole(trip, user?.id ?? undefined);
  const [loading, setLoading] = useState(true);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [members, setMembers] = useState<{ user_id: string; email: string | null; role: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [destinationImageUrl, setDestinationImageUrl] = useState<string | null>(null);
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);

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
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (shareModalOpen && trip?.id && canManageSharing) {
      let cancelled = false;
      setMembersLoading(true);
      supabase
        .rpc("get_trip_members", { p_trip_id: trip.id })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error(error);
            setMembers([]);
          } else {
            setMembers((data ?? []) as { user_id: string; email: string | null; role: string }[]);
          }
          setMembersLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!shareModalOpen) setMembers([]);
  }, [shareModalOpen, trip?.id, canManageSharing]);

  const handleShare = async () => {
    if (!id || !trip || !shareEmail.trim()) return;
    setShareError(null);
    setShareLoading(true);
    const { data, error } = await supabase.rpc("share_trip", {
      p_trip_id: trip.id,
      p_email: shareEmail,
      p_role: shareRole,
    });
    setShareLoading(false);
    const result = data as { ok?: boolean; message?: string } | null;
    if (error) {
      setShareError(error.message);
      return;
    }
    if (result?.ok) {
      setShareEmail("");
      setShareSuccess(true);
      const { data: memberData } = await supabase.rpc("get_trip_members", {
        p_trip_id: trip.id,
      });
      setMembers((memberData ?? []) as { user_id: string; email: string | null; role: string }[]);
      setTimeout(() => setShareSuccess(false), 3000);
    } else {
      setShareError(result?.message ?? "Could not share.");
    }
  };

  const handleUnshare = async (memberUserId: string) => {
    if (!id) return;
    setRemovingUserId(memberUserId);
    const { data, error } = await supabase.rpc("unshare_trip", {
      p_trip_id: id,
      p_user_id: memberUserId,
    });
    setRemovingUserId(null);
    const result = data as { ok?: boolean; message?: string } | null;
    if (error) {
      setShareError(error.message);
      return;
    }
    if (!result?.ok) {
      setShareError(result?.message ?? "Could not remove.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
  };

  const handleChangeRole = async (memberUserId: string, newRole: "admin" | "editor" | "viewer") => {
    if (!trip?.id) return;
    setChangingRoleUserId(memberUserId);
    const { error } = await supabase
      .from("trip_members")
      .update({ role: newRole })
      .eq("trip_id", trip.id)
      .eq("user_id", memberUserId);
    setChangingRoleUserId(null);
    if (error) {
      setShareError(error.message);
      return;
    }
    setShareError(null);
    setMembers((prev) =>
      prev.map((m) => (m.user_id === memberUserId ? { ...m, role: newRole } : m))
    );
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Signed URL for private cover image (1 hour expiry)
  useEffect(() => {
    if (!trip?.cover_image_path) {
      setCoverImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("trip-covers")
      .createSignedUrl(trip.cover_image_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Cover signed URL:", error);
          setCoverImageUrl(null);
        } else if (data?.signedUrl) {
          setCoverImageUrl(data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.cover_image_path]);

  // Signed URL for destination (hero) image when set
  useEffect(() => {
    if (!trip?.destination_image_url) {
      setDestinationImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("trip-covers")
      .createSignedUrl(trip.destination_image_url, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Destination image signed URL:", error);
          setDestinationImageUrl(null);
        } else if (data?.signedUrl) {
          setDestinationImageUrl(data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.destination_image_url]);

  useEffect(() => {
    if (!trip?.id) {
      setParticipantAvatarUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("avatar_path, sort_order")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null }[];
        Promise.all(
          rows.map(async (r) => {
            if (!r.avatar_path) return null;
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(r.avatar_path, 3600);
            return signed?.signedUrl ?? null;
          })
        ).then((urls) => {
          if (!cancelled) setParticipantAvatarUrls(urls);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.id]);

  const refetchTrip = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) setTrip(data as Trip);
  };

  const refetchParticipants = async () => {
    if (!trip?.id) return;
    const { data, error } = await supabase
      .from("trip_participants")
      .select("avatar_path, sort_order")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true });
    if (error || !data) {
      setParticipantAvatarUrls([]);
      return;
    }
    const rows = (data ?? []) as { avatar_path: string | null }[];
    const urls = await Promise.all(
      rows.map(async (r) => {
        if (!r.avatar_path) return null;
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(r.avatar_path, 3600);
        return signed?.signedUrl ?? null;
      })
    );
    setParticipantAvatarUrls(urls);
  };

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
    <main className="min-h-screen bg-[#F8F6F4]">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        {loading ? (
          <p className={META_CLASS}>Loading…</p>
        ) : !trip ? (
          <div className="space-y-3">
            <h1 className={SECTION_TITLE_CLASS}>Trip</h1>
            <p className={META_CLASS}>Trip id: {id ?? "—"}</p>
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
                imageUrl={coverImageUrl ?? trip.cover_image_url ?? undefined}
                onBack={() => router.push("/dashboard")}
                participants={participantAvatarUrls.map((avatarUrl) => ({ avatarUrl }))}
                topRight={
                  <div className="relative flex items-center gap-2" ref={menuRef}>
                    {canManageSharing && (
                      <button
                        type="button"
                        title="Share"
                        className="flex h-9 items-center gap-1.5 rounded-full bg-[#f6f2ed]/90 px-3 text-sm font-medium text-[#d97b5e] backdrop-blur-sm transition hover:bg-[#ebe5df] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 focus:ring-offset-transparent active:bg-[#e0d9d2]"
                        aria-label="Share trip"
                        onClick={() => {
                          setShareModalOpen(true);
                          setShareError(null);
                          setShareSuccess(false);
                        }}
                      >
                        <Share2Icon />
                        Share
                      </button>
                    )}
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
                        {canEditMetadata && (
                          <button
                            type="button"
                            className="w-full px-4 py-2 text-left text-sm text-[#4A4A4A] hover:bg-[#F5F3F0]"
                            onClick={() => {
                              setMenuOpen(false);
                              setEditModalOpen(true);
                            }}
                          >
                            Edit trip
                          </button>
                        )}
                        {canDeleteTrip && (
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
                        )}
                        {menuOpen && !canEditMetadata && !canDeleteTrip && (
                          <p className="px-4 py-2 text-xs text-[#8a8a8a]">No actions available</p>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            </div>

            {/* Compact summary strip */}
            <div className="mt-6">
              <TripDashboardSummaryStrip tripId={trip.id} />
            </div>

            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Destination / Places & map (prominent: full-width, links to places page) */}
                <article
                  className={`md:col-span-2 cursor-pointer transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden rounded-2xl border border-[#ebe5df] shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${destinationImageUrl ? "min-h-[140px]" : DASHBOARD_CARD_CLASS}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/dashboard/trip/${trip.id}/places`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/dashboard/trip/${trip.id}/places`);
                    }
                  }}
                >
                  {destinationImageUrl ? (
                    <>
                      <div className="relative h-[140px] w-full overflow-hidden rounded-2xl bg-neutral-200">
                        <img
                          src={destinationImageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
                          aria-hidden
                        />
                        <div className="relative flex h-full flex-col justify-end p-5">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="size-5 shrink-0 text-white/90" />
                            <h2 className="text-base font-semibold tracking-tight text-white">
                              Places & map
                            </h2>
                          </div>
                          {trip.destination?.trim() ? (
                            <p className="mt-1 text-sm text-white/90">
                              {trip.destination}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-white/80">
                              Your saved places will appear here
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-5">
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="size-5 shrink-0 text-[#8a8a8a]" />
                          <h2 className={SECTION_TITLE_CLASS}>Places & map</h2>
                        </div>
                        {trip.destination?.trim() ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-[#2d2d2d]">
                              {trip.destination}
                            </p>
                            <span className="text-xs text-[#8a8a8a]">
                              Your saved places will appear here
                            </span>
                          </div>
                        ) : (
                          <div className={`mt-4 ${DESTINATION_PLACEHOLDER_CLASS}`}>
                            <div className="text-center">
                              <MapPinIcon className="mx-auto mb-2" />
                              <p className="text-sm font-medium text-[#2d2d2d]">
                                View your trip map
                              </p>
                              <p className="mt-0.5 text-xs text-[#8a8a8a]">
                                Places you add will appear here
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </article>

                {/* Budget (first) */}
                <BudgetSummaryCard tripId={trip.id} />

                {/* Trip Notes */}
                <TripNotesSummaryCard tripId={trip.id} />

                {/* Packing */}
                <PackingSummaryCard tripId={trip.id} />

                {/* Tasks */}
                <TasksSummaryCard tripId={trip.id} />

                {/* Photos */}
                <PhotosSummaryCard tripId={trip.id} />
              </div>
            </div>
          </>
        )}
      </div>

      <TripFormModal
        mode="edit"
        trip={trip}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          refetchTrip();
          refetchParticipants();
        }}
      />

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent>
          <div className="flex max-h-[85vh] max-w-[420px] w-full flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
                Share this trip
              </DialogTitle>
              <p className="mt-1 text-[15px] leading-relaxed text-[#6b6b6b]">
                Invite someone by email to collaborate on this trip.
              </p>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="share-email"
                  className="block text-sm font-medium text-[#1f1f1f]"
                >
                  Email
                </label>
                <input
                  id="share-email"
                  type="email"
                  placeholder="name@example.com"
                  value={shareEmail}
                  onChange={(e) => {
                    setShareEmail(e.target.value);
                    setShareError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (shareEmail.trim() && !shareLoading) handleShare();
                    }
                  }}
                  disabled={shareLoading}
                  aria-invalid={!!shareError}
                  aria-describedby={shareError ? "share-error" : shareSuccess ? "share-success" : "share-helper"}
                  className="mt-1.5 w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-60 aria-[invalid=true]:focus:ring-red-400/40 aria-[invalid=true]:focus:border-red-400"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Role for new member"
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value as "admin" | "editor" | "viewer")}
                    className="rounded-[20px] border border-[#e0d9d2] bg-[#f6f2ed] px-3 py-2 text-sm text-[#1f1f1f] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    className="flex h-[48px] min-w-[100px] items-center justify-center rounded-full bg-[#d97b5e] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 focus:ring-offset-white active:bg-[#b85a42] disabled:opacity-60 disabled:hover:bg-[#d97b5e]"
                    onClick={handleShare}
                    disabled={shareLoading || !shareEmail.trim()}
                  >
                    {shareLoading ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                        Please wait…
                      </>
                    ) : (
                      "Share"
                    )}
                  </button>
                </div>
                {shareError && (
                  <p id="share-error" className="mt-1.5 text-sm text-red-600" role="alert">
                    {shareError}
                  </p>
                )}
                {shareSuccess && (
                  <p id="share-success" className="mt-1.5 text-sm text-[#16a34a]" role="status">
                    Added.
                  </p>
                )}
                <p id="share-helper" className="mt-1.5 text-xs text-[#8a8a8a]">
                  Viewer: read-only. Editor: can edit content. Admin: can edit and manage sharing.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#1f1f1f]">
                  People with access
                </h3>
                {membersLoading ? (
                  <div className="mt-2 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-11 rounded-[20px] bg-[#f0ebe6] animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2" role="list">
                    {trip && (
                      <li className="flex items-center justify-between gap-2 rounded-[20px] bg-[#ebe5df] px-3 py-2.5 text-sm">
                        <span className="truncate font-medium text-[#1f1f1f]">
                          {trip.user_id === user?.id ? "You (owner)" : "Trip owner"}
                        </span>
                        <span className="shrink-0 rounded-full bg-[#d97b5e]/20 px-2 py-0.5 text-xs font-medium text-[#b85a42]">
                          Owner
                        </span>
                      </li>
                    )}
                    {members.length === 0 ? (
                      <li className="py-2 text-sm text-[#8a8a8a]">
                        No other members yet.
                      </li>
                    ) : (
                      members.map((m) => (
                        <li
                          key={m.user_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] bg-[#f6f2ed] px-3 py-2.5 text-sm shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                        >
                          <span className="truncate text-[#1f1f1f]">
                            {m.email ?? m.user_id}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <select
                              aria-label={`Change role for ${m.email ?? m.user_id}`}
                              value={m.role}
                              onChange={(e) =>
                                handleChangeRole(m.user_id, e.target.value as "admin" | "editor" | "viewer")
                              }
                              disabled={changingRoleUserId === m.user_id}
                              className="rounded-full border border-[#e0d9d2] bg-white px-2 py-1 text-xs text-[#1f1f1f] disabled:opacity-50"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#d97b5e] transition hover:bg-[#d97b5e]/10 focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-50"
                              onClick={() => handleUnshare(m.user_id)}
                              disabled={removingUserId === m.user_id}
                            >
                              {removingUserId === m.user_id ? "Removing…" : "Remove"}
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            </div>
            <div className="mt-4 shrink-0 flex justify-end border-t border-[#e0d9d2] pt-4">
              <button
                type="button"
                className="rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2"
                onClick={() => setShareModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
