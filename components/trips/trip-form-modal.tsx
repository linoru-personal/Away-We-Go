"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";

export type TripForForm = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  created_at: string | null;
};

export interface TripFormModalProps {
  mode: "create" | "edit";
  trip?: TripForForm | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const INPUT_CLASS =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const LABEL_CLASS = "block text-sm font-medium text-[#1f1f1f]";

type ParticipantRow = {
  id: string;
  name: string;
  avatarPath: string | null;
  avatarFile: File | null;
  previewUrl: string | null;
};

const AVATARS_BUCKET = "avatars";

export default function TripFormModal({
  mode,
  trip,
  open,
  onClose,
  onSuccess,
}: TripFormModalProps) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [existingCoverSignedUrl, setExistingCoverSignedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);

  const isCreate = mode === "create";

  // Prefill when editing
  useEffect(() => {
    if (open && trip && mode === "edit") {
      setTitle(trip.title ?? "");
      setDestination(trip.destination ?? "");
      setStartDate(trip.start_date ?? "");
      setEndDate(trip.end_date ?? "");
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setError(null);
      if (trip.cover_image_path) {
        supabase.storage
          .from("trip-covers")
          .createSignedUrl(trip.cover_image_path, 3600)
          .then(({ data }) => {
            if (data?.signedUrl) setExistingCoverSignedUrl(data.signedUrl);
            else setExistingCoverSignedUrl(null);
          });
      } else {
        setExistingCoverSignedUrl(null);
      }
    }
  }, [open, trip?.id, trip?.title, trip?.destination, trip?.start_date, trip?.end_date, trip?.cover_image_path, mode]);

  // Load participants when editing
  useEffect(() => {
    if (!open || !trip || mode !== "edit") return;
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("id, name, avatar_path, sort_order")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError || !data) {
          setParticipants([]);
          return;
        }
        const rows = (data ?? []) as { id: string; name: string; avatar_path: string | null; sort_order: number }[];
        if (rows.length === 0) {
          setParticipants([]);
          return;
        }
        Promise.all(
          rows.map(async (r) => {
            let previewUrl: string | null = null;
            if (r.avatar_path) {
              const { data: signed } = await supabase.storage
                .from(AVATARS_BUCKET)
                .createSignedUrl(r.avatar_path, 3600);
              previewUrl = signed?.signedUrl ?? null;
            }
            return {
              id: r.id,
              name: r.name,
              avatarPath: r.avatar_path,
              avatarFile: null,
              previewUrl,
            };
          })
        ).then((list) => {
          if (!cancelled) setParticipants(list);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, trip?.id, mode]);

  // Reset when opening create modal
  useEffect(() => {
    if (open && mode === "create") {
      setTitle("");
      setDestination("");
      setStartDate("");
      setEndDate("");
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setExistingCoverSignedUrl(null);
      setError(null);
      setParticipants([]);
    }
  }, [open, mode]);

  // Revoke blob URLs when participants change (cleanup object URLs)
  useEffect(() => {
    return () => {
      participants.forEach((p) => {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [participants]);

  // Preview for newly selected file
  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && file.type.startsWith("image/")) {
      setCoverFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setCoverFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", avatarPath: null, avatarFile: null, previewUrl: null },
    ]);
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const setParticipantName = (id: string, name: string) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const setParticipantPhoto = (id: string, file: File | null) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
        return {
          ...p,
          avatarFile: file,
          previewUrl: file ? URL.createObjectURL(file) : p.avatarPath ? null : null,
        };
      })
    );
  };

  const validate = (): boolean => {
    const t = title.trim();
    if (!t) {
      setError("Trip name is required.");
      return false;
    }
    const d = destination.trim();
    if (!d) {
      setError("Destination is required.");
      return false;
    }
    if (!startDate.trim()) {
      setError("Start date is required.");
      return false;
    }
    if (!endDate.trim()) {
      setError("End date is required.");
      return false;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("End date must be on or after start date.");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);

    try {
      if (isCreate) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("You must be signed in to create a trip.");
          setSaving(false);
          return;
        }

        const tripId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from("trips")
          .insert({
            id: tripId,
            user_id: user.id,
            title: title.trim(),
            destination: destination.trim(),
            start_date: startDate || null,
            end_date: endDate || null,
          });

        if (insertError) {
          console.error("TRIPS INSERT ERROR", insertError);
          setError(insertError.message);
          setSaving(false);
          return;
        }

        if (coverFile) {
          const path = `${tripId}/cover.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("trip-covers")
            .upload(path, coverFile, { upsert: true, contentType: coverFile.type });
          if (uploadError) {
            console.error("TRIPS UPLOAD ERROR", uploadError);
          } else {
            const { error: updateError } = await supabase
              .from("trips")
              .update({ cover_image_path: path })
              .eq("id", tripId);
            if (updateError) {
              console.error("TRIPS UPDATE ERROR", updateError);
            }
          }
        }
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          const name = p.name.trim();
          if (!name) continue;
          let avatarPath: string | null = null;
          if (p.avatarFile) {
            const path = `${tripId}/${p.id}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from(AVATARS_BUCKET)
              .upload(path, p.avatarFile, { upsert: true, contentType: p.avatarFile.type });
            if (!uploadError) avatarPath = path;
          }
          await supabase.from("trip_participants").insert({
            id: p.id,
            trip_id: tripId,
            name,
            avatar_path: avatarPath,
            sort_order: i,
          });
        }
        onSuccess?.();
        onClose();
      } else if (trip) {
        const { error: updateError } = await supabase
          .from("trips")
          .update({
            title: title.trim(),
            destination: destination.trim(),
            start_date: startDate || null,
            end_date: endDate || null,
          })
          .eq("id", trip.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }

        if (coverFile && trip.id) {
          const path = `${trip.id}/cover.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("trip-covers")
            .upload(path, coverFile, { upsert: true, contentType: coverFile.type });
          if (!uploadError) {
            await supabase
              .from("trips")
              .update({ cover_image_path: path })
              .eq("id", trip.id);
          }
        }
        await supabase.from("trip_participants").delete().eq("trip_id", trip.id);
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          const name = p.name.trim();
          if (!name) continue;
          let avatarPath: string | null = p.avatarPath;
          if (p.avatarFile) {
            const path = `${trip.id}/${p.id}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from(AVATARS_BUCKET)
              .upload(path, p.avatarFile, { upsert: true, contentType: p.avatarFile.type });
            if (!uploadError) avatarPath = path;
          }
          await supabase.from("trip_participants").insert({
            id: p.id,
            trip_id: trip.id,
            name,
            avatar_path: avatarPath,
            sort_order: i,
          });
        }
        onSuccess?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const displayCoverUrl = coverPreviewUrl ?? existingCoverSignedUrl;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="max-h-[85vh] overflow-y-auto"
          onSubmit={handleSubmit}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
              {isCreate ? "Create trip" : "Edit trip"}
            </DialogTitle>
            <p className="mt-1 text-[15px] leading-relaxed text-[#6b6b6b]">
              {isCreate
                ? "Add a name, destination, dates, and an optional cover image."
                : "Update trip details and cover image."}
            </p>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            {/* Cover upload area */}
            <div>
              <label className={LABEL_CLASS}>Cover image (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="mt-1.5 flex h-[180px] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#e0d9d2] bg-[#fbf7f2] transition hover:border-[#d97b5e]/50 hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
              >
                {displayCoverUrl ? (
                  <img
                    src={displayCoverUrl}
                    alt="Cover preview"
                    className="h-full w-full rounded-[18px] object-cover"
                  />
                ) : (
                  <span className="text-sm text-[#8a8a8a]">
                    Drop an image or click to upload
                  </span>
                )}
              </button>
            </div>

            <div>
              <label htmlFor="trip-form-title" className={LABEL_CLASS}>
                Trip name (required)
              </label>
              <input
                id="trip-form-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Summer in Iceland"
                className={`mt-1.5 ${INPUT_CLASS}`}
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="trip-form-destination" className={LABEL_CLASS}>
                Destination (required)
              </label>
              <input
                id="trip-form-destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Reykjavik, Iceland"
                className={`mt-1.5 ${INPUT_CLASS}`}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-start" className={LABEL_CLASS}>
                  Start date (required)
                </label>
                <input
                  id="trip-form-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`mt-1.5 ${INPUT_CLASS}`}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="trip-form-end" className={LABEL_CLASS}>
                  End date (required)
                </label>
                <input
                  id="trip-form-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`mt-1.5 ${INPUT_CLASS}`}
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={LABEL_CLASS}>Participants (optional)</label>
                <button
                  type="button"
                  onClick={addParticipant}
                  disabled={saving}
                  className="text-sm font-medium text-[#d97b5e] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-50"
                >
                  Add participant
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-[20px] border border-[#e0d9d2] bg-[#fbf7f2] p-3"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#e0d9d2] bg-[#f6f2ed]">
                      {p.previewUrl ? (
                        <img
                          src={p.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-medium text-[#8a8a8a]">
                          {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => setParticipantName(p.id, e.target.value)}
                      placeholder="Name"
                      className={`flex-1 ${INPUT_CLASS} py-2`}
                      disabled={saving}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-hidden
                      id={`participant-photo-${p.id}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file?.type.startsWith("image/")) setParticipantPhoto(p.id, file);
                      }}
                    />
                    <label
                      htmlFor={`participant-photo-${p.id}`}
                      className="cursor-pointer rounded-full px-3 py-2 text-xs font-medium text-[#6b6b6b] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
                    >
                      {p.previewUrl || p.avatarPath ? "Change photo" : "Add photo"}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      disabled={saving}
                      className="shrink-0 rounded-full p-2 text-[#8a8a8a] transition hover:bg-[#f6f2ed] hover:text-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-50"
                      aria-label="Remove participant"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-full border border-[#e0d9d2] bg-transparent px-4 py-3 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-[#d97b5e] px-4 py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 focus:ring-offset-white active:bg-[#b85a42] disabled:opacity-60"
            >
              {saving ? "Please wait…" : isCreate ? "Create Trip" : "Save Changes"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
