"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";
import { DestinationImageCropDialog } from "@/components/trips/destination-image-crop-dialog";
import { CoverImageCropDialog } from "@/components/trips/cover-image-crop-dialog";
import { AvatarCropDialog } from "@/components/trips/avatar-crop-dialog";
import {
  ImageActionsOverlay,
  PencilIcon,
  TrashIcon,
  ImagePlusIcon,
} from "@/components/trips/image-actions-overlay";
import type { CropMetadata } from "@/lib/editable-image-assets";
import { getEditableImageSource } from "@/lib/editable-image-assets/get-source";
import {
  saveEditableImageAsset,
  getExistingEditableAssetId,
  updateEditableImageAssetCrop,
} from "@/lib/editable-image-assets/upload";

export type TripForForm = {
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
  /** For new avatar: original file and crop result for persistence. */
  avatarOriginalFile: File | null;
  avatarCroppedBlob: Blob | null;
  avatarCropMetadata: CropMetadata | null;
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
  const [coverCroppedBlob, setCoverCroppedBlob] = useState<Blob | null>(null);
  const [coverCropMetadata, setCoverCropMetadata] = useState<CropMetadata | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [existingCoverSignedUrl, setExistingCoverSignedUrl] = useState<string | null>(null);
  const [existingDestinationSignedUrl, setExistingDestinationSignedUrl] = useState<string | null>(null);
  const [destinationCropOpen, setDestinationCropOpen] = useState(false);
  const [destinationImageSrcForCrop, setDestinationImageSrcForCrop] = useState<string | null>(null);
  const destinationFileForCropRef = useRef<File | null>(null);
  const coverRecropContextRef = useRef<{ existingAssetId: string | null; cropMetadata: CropMetadata | null } | null>(null);
  const destinationRecropContextRef = useRef<{ existingAssetId: string | null; cropMetadata: CropMetadata | null } | null>(null);
  const avatarRecropContextRef = useRef<{ participantId: string; existingAssetId: string | null; cropMetadata: CropMetadata | null } | null>(null);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverImageSrcForCrop, setCoverImageSrcForCrop] = useState<string | null>(null);
  const [coverSourceLoading, setCoverSourceLoading] = useState(false);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarImageSrcForCrop, setAvatarImageSrcForCrop] = useState<string | null>(null);
  const [participantIdForAvatarCrop, setParticipantIdForAvatarCrop] = useState<string | null>(null);
  const [destinationSourceLoading, setDestinationSourceLoading] = useState(false);
  const [destinationPendingOriginalFile, setDestinationPendingOriginalFile] = useState<File | null>(null);
  const [destinationPendingCroppedBlob, setDestinationPendingCroppedBlob] = useState<Blob | null>(null);
  const [destinationPendingCropMetadata, setDestinationPendingCropMetadata] = useState<CropMetadata | null>(null);
  const [destinationPreviewUrl, setDestinationPreviewUrl] = useState<string | null>(null);
  const avatarOriginalFileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const destinationFileInputRef = useRef<HTMLInputElement>(null);
  const hasJustUploadedDestinationRef = useRef(false);
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
      setCoverCroppedBlob(null);
      setCoverCropMetadata(null);
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
      if (trip.destination_image_url) {
        hasJustUploadedDestinationRef.current = false;
        supabase.storage
          .from("trip-covers")
          .createSignedUrl(trip.destination_image_url, 3600)
          .then(({ data }) => {
            if (data?.signedUrl) setExistingDestinationSignedUrl(data.signedUrl);
            else setExistingDestinationSignedUrl(null);
          });
      } else if (!hasJustUploadedDestinationRef.current) {
        setExistingDestinationSignedUrl(null);
      } else {
        hasJustUploadedDestinationRef.current = false;
      }
    }
  }, [open, trip?.id, trip?.title, trip?.destination, trip?.start_date, trip?.end_date, trip?.cover_image_path, trip?.destination_image_url, mode]);

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
              avatarOriginalFile: null,
              avatarCroppedBlob: null,
              avatarCropMetadata: null,
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
      setCoverCroppedBlob(null);
      setCoverCropMetadata(null);
      setCoverPreviewUrl(null);
      setExistingCoverSignedUrl(null);
      setExistingDestinationSignedUrl(null);
      setDestinationPendingOriginalFile(null);
      setDestinationPendingCroppedBlob(null);
      setDestinationPendingCropMetadata(null);
      setDestinationPreviewUrl(null);
      setCoverCropOpen(false);
      setCoverImageSrcForCrop(null);
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

  // Preview: show cropped result when we have it; otherwise existing signed URL
  useEffect(() => {
    if (!coverCroppedBlob) return;
    const url = URL.createObjectURL(coverCroppedBlob);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverCroppedBlob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && file.type.startsWith("image/")) {
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverImageSrcForCrop(url);
      setCoverCropOpen(true);
    }
  };

  const handleEditCoverCrop = async () => {
    if (!trip?.id) return;
    setCoverSourceLoading(true);
    try {
      const source = await getEditableImageSource(supabase, {
        tripId: trip.id,
        ownerType: "trip_cover",
        legacyPath: trip.cover_image_path,
      });
      if (!source) {
        if (existingCoverSignedUrl) {
          setCoverImageSrcForCrop(existingCoverSignedUrl);
          coverRecropContextRef.current = { existingAssetId: null, cropMetadata: null };
          setCoverCropOpen(true);
        }
        return;
      }
      coverRecropContextRef.current = {
        existingAssetId: source.existingAssetId,
        cropMetadata: source.cropMetadata,
      };
      setCoverImageSrcForCrop(source.originalPath);
      setCoverCropOpen(true);
    } finally {
      setCoverSourceLoading(false);
    }
  };

  const handleCoverCropClose = (open: boolean) => {
    if (!open) {
      if (coverImageSrcForCrop?.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageSrcForCrop);
      }
      if (!coverCroppedBlob) {
        setCoverFile(null);
      }
      coverRecropContextRef.current = null;
    }
    setCoverCropOpen(open);
    if (!open) setCoverImageSrcForCrop(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverImageSrcForCrop(url);
      setCoverCropOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDestinationImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && file.type.startsWith("image/")) {
      destinationFileForCropRef.current = file;
      const url = URL.createObjectURL(file);
      setDestinationImageSrcForCrop(url);
      setDestinationCropOpen(true);
    }
  };

  const handleDestinationCropClose = (open: boolean) => {
    if (!open) {
      if (destinationImageSrcForCrop?.startsWith("blob:")) {
        URL.revokeObjectURL(destinationImageSrcForCrop);
      }
      destinationFileForCropRef.current = null;
      destinationRecropContextRef.current = null;
    }
    setDestinationCropOpen(open);
    if (!open) setDestinationImageSrcForCrop(null);
  };

  const handleEditDestinationCrop = async () => {
    if (!trip?.id) return;
    setDestinationSourceLoading(true);
    try {
      const source = await getEditableImageSource(supabase, {
        tripId: trip.id,
        ownerType: "destination_cover",
        legacyPath: trip.destination_image_url,
      });
      if (!source) {
        if (existingDestinationSignedUrl) {
          setDestinationImageSrcForCrop(existingDestinationSignedUrl);
          destinationRecropContextRef.current = { existingAssetId: null, cropMetadata: null };
          setDestinationCropOpen(true);
        }
        return;
      }
      destinationRecropContextRef.current = {
        existingAssetId: source.existingAssetId,
        cropMetadata: source.cropMetadata,
      };
      setDestinationImageSrcForCrop(source.originalPath);
      setDestinationCropOpen(true);
    } finally {
      setDestinationSourceLoading(false);
    }
  };

  const removeCoverImage = async () => {
    if (!trip?.id) return;
    await supabase
      .from("trips")
      .update({ cover_image_path: null })
      .eq("id", trip.id);
    setExistingCoverSignedUrl(null);
    setCoverPreviewUrl(null);
    setCoverFile(null);
    setCoverCroppedBlob(null);
    setCoverCropMetadata(null);
    onSuccess?.();
  };

  const removeDestinationImage = async () => {
    if (!trip?.id) return;
    await supabase
      .from("trips")
      .update({ destination_image_url: null })
      .eq("id", trip.id);
    setExistingDestinationSignedUrl(null);
    onSuccess?.();
  };

  const clearDestinationPending = () => {
    if (destinationPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(destinationPreviewUrl);
    setDestinationPendingOriginalFile(null);
    setDestinationPendingCroppedBlob(null);
    setDestinationPendingCropMetadata(null);
    setDestinationPreviewUrl(null);
  };

  const handleEditDestinationCropCreate = () => {
    if (!destinationPendingOriginalFile) return;
    const url = URL.createObjectURL(destinationPendingOriginalFile);
    setDestinationImageSrcForCrop(url);
    destinationRecropContextRef.current = {
      existingAssetId: null,
      cropMetadata: destinationPendingCropMetadata,
    };
    setDestinationCropOpen(true);
  };

  const addParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        avatarPath: null,
        avatarFile: null,
        previewUrl: null,
        avatarOriginalFile: null,
        avatarCroppedBlob: null,
        avatarCropMetadata: null,
      },
    ]);
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  /** Clear participant photo only (keep participant in list). */
  const clearParticipantPhoto = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== participantId) return p;
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
        return {
          ...p,
          avatarPath: null,
          avatarFile: null,
          previewUrl: null,
          avatarOriginalFile: null,
          avatarCroppedBlob: null,
          avatarCropMetadata: null,
        };
      })
    );
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

  const setParticipantAvatarCropResult = (
    id: string,
    originalFile: File,
    blob: Blob,
    cropMetadata: CropMetadata
  ) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
        const previewUrl = URL.createObjectURL(blob);
        return {
          ...p,
          avatarFile: new File([blob], "avatar.jpg", { type: "image/jpeg" }),
          previewUrl,
          avatarOriginalFile: originalFile,
          avatarCroppedBlob: blob,
          avatarCropMetadata: cropMetadata,
        };
      })
    );
  };

  const handleParticipantPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, participantId: string) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file?.type.startsWith("image/")) {
      avatarOriginalFileRef.current = file;
      const url = URL.createObjectURL(file);
      setAvatarImageSrcForCrop(url);
      setParticipantIdForAvatarCrop(participantId);
      setAvatarCropOpen(true);
    }
  };

  const handleAvatarCropClose = (open: boolean) => {
    setAvatarCropOpen(open);
    if (!open) {
      const src = avatarImageSrcForCrop;
      setAvatarImageSrcForCrop(null);
      setParticipantIdForAvatarCrop(null);
      avatarRecropContextRef.current = null;
      // Only revoke if this URL was created for crop (file select); don't revoke when user opened recrop from existing avatar
      if (src?.startsWith("blob:") && !participants.some((p) => p.previewUrl === src)) {
        URL.revokeObjectURL(src);
      }
    }
  };

  const handleEditAvatarCrop = async (participantId: string) => {
    if (!trip?.id) return;
    const p = participants.find((x) => x.id === participantId);
    if (!p?.avatarPath) return;
    setParticipantIdForAvatarCrop(participantId);
    try {
      const source = await getEditableImageSource(supabase, {
        tripId: trip.id,
        ownerType: "participant_avatar",
        participantId,
        legacyPath: p.avatarPath,
      });
      if (!source) {
        const { data: signed } = await supabase.storage
          .from(AVATARS_BUCKET)
          .createSignedUrl(p.avatarPath, 3600);
        if (signed?.signedUrl) {
          avatarRecropContextRef.current = { participantId, existingAssetId: null, cropMetadata: null };
          setAvatarImageSrcForCrop(signed.signedUrl);
          setAvatarCropOpen(true);
        }
        return;
      }
      avatarRecropContextRef.current = {
        participantId,
        existingAssetId: source.existingAssetId,
        cropMetadata: source.cropMetadata,
      };
      setAvatarImageSrcForCrop(source.originalPath);
      setAvatarCropOpen(true);
    } finally {
      // no loading state for avatar
    }
  };

  const handleAvatarCropComplete = async (blob: Blob, cropMetadata: CropMetadata) => {
    const participantId = participantIdForAvatarCrop;
    const originalFile = avatarOriginalFileRef.current;
    const recrop = avatarRecropContextRef.current;
    const srcUrl = avatarImageSrcForCrop;
    if (srcUrl?.startsWith("blob:")) URL.revokeObjectURL(srcUrl);
    setAvatarImageSrcForCrop(null);
    setParticipantIdForAvatarCrop(null);
    avatarOriginalFileRef.current = null;
    avatarRecropContextRef.current = null;

    if (recrop && recrop.participantId === participantId) {
      if (!trip?.id) return;
      try {
        if (recrop.existingAssetId) {
          await updateEditableImageAssetCrop(supabase, {
            existingAssetId: recrop.existingAssetId,
            tripId: trip.id,
            ownerType: "participant_avatar",
            participantId,
            croppedBlob: blob,
            cropMetadata,
          });
        } else {
          const res = await fetch(srcUrl!);
          const legacyBlob = await res.blob();
          const originalFileFromLegacy = new File([legacyBlob], "original.jpg", { type: "image/jpeg" });
          await saveEditableImageAsset(supabase, {
            tripId: trip.id,
            ownerType: "participant_avatar",
            participantId,
            originalFile: originalFileFromLegacy,
            croppedBlob: blob,
            cropMetadata,
          });
        }
        onSuccess?.();
        const path = `${trip.id}/${participantId}.jpg`;
        const { data } = await supabase.storage.from(AVATARS_BUCKET).createSignedUrl(path, 3600);
        const newPreviewUrl = data?.signedUrl ?? null;
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, previewUrl: newPreviewUrl, avatarPath: path } : p
          )
        );
      } catch (err) {
        console.error("Avatar save failed", err);
      }
      return;
    }

    if (!participantId || !originalFile) return;
    setParticipantAvatarCropResult(participantId, originalFile, blob, cropMetadata);
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

        if (coverFile && coverCroppedBlob && coverCropMetadata) {
          try {
            await saveEditableImageAsset(supabase, {
              tripId,
              ownerType: "trip_cover",
              originalFile: coverFile,
              croppedBlob: coverCroppedBlob,
              cropMetadata: coverCropMetadata,
            });
          } catch (err) {
            console.error("Cover upload error", err);
            setError(err instanceof Error ? err.message : "Cover image upload failed.");
            setSaving(false);
            return;
          }
        }

        if (
          destinationPendingOriginalFile &&
          destinationPendingCroppedBlob &&
          destinationPendingCropMetadata
        ) {
          try {
            await saveEditableImageAsset(supabase, {
              tripId,
              ownerType: "destination_cover",
              originalFile: destinationPendingOriginalFile,
              croppedBlob: destinationPendingCroppedBlob,
              cropMetadata: destinationPendingCropMetadata,
            });
          } catch (err) {
            console.error("Destination image upload error", err);
          }
        }

        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          const name = p.name.trim();
          if (!name) continue;
          await supabase.from("trip_participants").insert({
            id: p.id,
            trip_id: tripId,
            name,
            avatar_path: null,
            sort_order: i,
          });
          if (p.avatarOriginalFile && p.avatarCroppedBlob && p.avatarCropMetadata) {
            try {
              await saveEditableImageAsset(supabase, {
                tripId,
                ownerType: "participant_avatar",
                participantId: p.id,
                originalFile: p.avatarOriginalFile,
                croppedBlob: p.avatarCroppedBlob,
                cropMetadata: p.avatarCropMetadata,
              });
            } catch (err) {
              console.error("Avatar upload error", err);
            }
          }
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

        if (coverFile && coverCroppedBlob && coverCropMetadata && trip.id) {
          try {
            const existingId = await getExistingEditableAssetId(supabase, trip.id, "trip_cover");
            await saveEditableImageAsset(supabase, {
              tripId: trip.id,
              ownerType: "trip_cover",
              originalFile: coverFile,
              croppedBlob: coverCroppedBlob,
              cropMetadata: coverCropMetadata,
              existingAssetId: existingId,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Cover image upload failed.");
            setSaving(false);
            return;
          }
        }

        await supabase.from("trip_participants").delete().eq("trip_id", trip.id);
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          const name = p.name.trim();
          if (!name) continue;
          await supabase.from("trip_participants").insert({
            id: p.id,
            trip_id: trip.id,
            name,
            avatar_path: p.avatarOriginalFile ? null : p.avatarPath,
            sort_order: i,
          });
          if (p.avatarOriginalFile && p.avatarCroppedBlob && p.avatarCropMetadata) {
            try {
              await saveEditableImageAsset(supabase, {
                tripId: trip.id,
                ownerType: "participant_avatar",
                participantId: p.id,
                originalFile: p.avatarOriginalFile,
                croppedBlob: p.avatarCroppedBlob,
                cropMetadata: p.avatarCropMetadata,
              });
            } catch (err) {
              console.error("Avatar upload error", err);
            }
          }
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
              <div className="mt-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="flex aspect-[16/6] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#e0d9d2] bg-[#fbf7f2] transition hover:border-[#d97b5e]/50 hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30"
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
                  {mode === "edit" && existingCoverSignedUrl && (
                    <ImageActionsOverlay
                      onEditCrop={handleEditCoverCrop}
                      onReplace={() => fileInputRef.current?.click()}
                      onRemove={removeCoverImage}
                      disabled={saving}
                      editLoading={coverSourceLoading}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Destination cover image</label>
              <input
                ref={destinationFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={handleDestinationImageSelect}
              />
              {(() => {
                const hasDestinationImage =
                  (mode === "edit" && !!existingDestinationSignedUrl) ||
                  (mode === "create" && !!destinationPreviewUrl);
                const destinationImageUrl = existingDestinationSignedUrl ?? destinationPreviewUrl;
                if (hasDestinationImage && destinationImageUrl) {
                  return (
                    <div className="relative mt-1.5 w-full max-w-[280px]">
                      <img
                        src={destinationImageUrl}
                        alt="Destination cover"
                        className="aspect-[16/6] w-full rounded-[12px] object-cover"
                      />
                      <ImageActionsOverlay
                        onEditCrop={
                          mode === "edit" && trip
                            ? handleEditDestinationCrop
                            : handleEditDestinationCropCreate
                        }
                        onReplace={() => destinationFileInputRef.current?.click()}
                        onRemove={
                          mode === "edit" && trip
                            ? removeDestinationImage
                            : clearDestinationPending
                        }
                        disabled={saving}
                        editLoading={destinationSourceLoading}
                      />
                    </div>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => destinationFileInputRef.current?.click()}
                    disabled={saving}
                    className="mt-1.5 flex aspect-[16/6] w-full max-w-[280px] items-center justify-center rounded-[12px] border-2 border-dashed border-[#e0d9d2] bg-[#fbf7f2] text-sm text-[#8a8a8a] transition hover:border-[#d97b5e]/50 hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-50"
                  >
                    Upload destination cover image
                  </button>
                );
              })()}
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
                    className="flex items-center gap-2 rounded-[20px] border border-[#e0d9d2] bg-[#fbf7f2] p-3"
                  >
                    <button
                      type="button"
                      onClick={() => document.getElementById(`participant-photo-${p.id}`)?.click()}
                      className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#e0d9d2] bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/50 focus:ring-inset"
                      title="Change photo"
                    >
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
                    </button>
                    <div className="flex min-w-0 flex-1">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => setParticipantName(p.id, e.target.value)}
                        placeholder="Name"
                        className={`w-full min-w-0 truncate ${INPUT_CLASS} py-2`}
                        disabled={saving}
                      />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-hidden
                      id={`participant-photo-${p.id}`}
                      onChange={(e) => handleParticipantPhotoSelect(e, p.id)}
                    />
                    <div className="flex shrink-0 items-center gap-1.5 text-[#1f1f1f] opacity-70">
                      {(p.previewUrl || p.avatarPath) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (p.avatarPath) {
                              handleEditAvatarCrop(p.id);
                            } else {
                              setAvatarImageSrcForCrop(p.previewUrl!);
                              setParticipantIdForAvatarCrop(p.id);
                              setAvatarCropOpen(true);
                            }
                          }}
                          disabled={saving}
                          className="flex size-7 shrink-0 items-center justify-center rounded-sm transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1f1f1f]/25 focus:ring-offset-0 disabled:opacity-50 sm:size-8"
                          aria-label="Edit crop"
                          title="Edit crop"
                        >
                          <PencilIcon className="size-3 sm:size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => document.getElementById(`participant-photo-${p.id}`)?.click()}
                        disabled={saving}
                        className="flex size-7 shrink-0 items-center justify-center rounded-sm transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1f1f1f]/25 focus:ring-offset-0 disabled:opacity-50 sm:size-8"
                        aria-label="Change photo"
                        title="Change photo"
                      >
                        <ImagePlusIcon className="size-3 sm:size-3.5" />
                      </button>
                      {(p.previewUrl || p.avatarPath) ? (
                        <button
                          type="button"
                          onClick={() => clearParticipantPhoto(p.id)}
                          disabled={saving}
                          className="flex size-7 shrink-0 items-center justify-center rounded-sm transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1f1f1f]/25 focus:ring-offset-0 disabled:opacity-50 sm:size-8"
                          aria-label="Remove photo"
                          title="Remove photo"
                        >
                          <TrashIcon className="size-3 sm:size-3.5" />
                        </button>
                      ) : null}
                    </div>
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

        {destinationImageSrcForCrop && (
          <DestinationImageCropDialog
            open={destinationCropOpen}
            onOpenChange={handleDestinationCropClose}
            imageSrc={destinationImageSrcForCrop}
            initialCropMetadata={destinationRecropContextRef.current?.cropMetadata ?? undefined}
            onCropComplete={async (blob, cropMetadata) => {
              const recrop = destinationRecropContextRef.current;
              const srcUrl = destinationImageSrcForCrop;
              const file = !recrop ? destinationFileForCropRef.current : null;
              setDestinationCropOpen(false);
              setDestinationImageSrcForCrop(null);
              destinationRecropContextRef.current = null;
              if (srcUrl?.startsWith("blob:")) URL.revokeObjectURL(srcUrl);
              destinationFileForCropRef.current = null;

              if (trip?.id) {
                try {
                  if (recrop) {
                    if (recrop.existingAssetId) {
                      await updateEditableImageAssetCrop(supabase, {
                        existingAssetId: recrop.existingAssetId,
                        tripId: trip.id,
                        ownerType: "destination_cover",
                        croppedBlob: blob,
                        cropMetadata,
                      });
                    } else {
                      const res = await fetch(srcUrl!);
                      const legacyBlob = await res.blob();
                      const originalFile = new File([legacyBlob], "original.jpg", { type: "image/jpeg" });
                      await saveEditableImageAsset(supabase, {
                        tripId: trip.id,
                        ownerType: "destination_cover",
                        originalFile,
                        croppedBlob: blob,
                        cropMetadata,
                      });
                    }
                  } else {
                    if (!file) return;
                    const existingId = await getExistingEditableAssetId(supabase, trip.id, "destination_cover");
                    await saveEditableImageAsset(supabase, {
                      tripId: trip.id,
                      ownerType: "destination_cover",
                      originalFile: file,
                      croppedBlob: blob,
                      cropMetadata,
                      existingAssetId: existingId,
                    });
                  }
                  onSuccess?.();
                  hasJustUploadedDestinationRef.current = true;
                  const path = `${trip.id}/destination.jpg`;
                  const { data } = await supabase.storage
                    .from("trip-covers")
                    .createSignedUrl(path, 3600);
                  if (data?.signedUrl) setExistingDestinationSignedUrl(data.signedUrl);
                } catch (err) {
                  console.error("Destination image save failed", err);
                }
                return;
              }

              if (mode === "create") {
                if (file) {
                  setDestinationPendingOriginalFile(file);
                }
                setDestinationPendingCroppedBlob(blob);
                setDestinationPendingCropMetadata(cropMetadata);
                setDestinationPreviewUrl((prev) => {
                  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(blob);
                });
              }
            }}
          />
        )}

        {coverImageSrcForCrop && (
          <CoverImageCropDialog
            open={coverCropOpen}
            onOpenChange={handleCoverCropClose}
            imageSrc={coverImageSrcForCrop}
            initialCropMetadata={coverRecropContextRef.current?.cropMetadata ?? undefined}
            onCropComplete={(blob, cropMetadata) => {
              const recrop = coverRecropContextRef.current;
              const srcUrl = coverImageSrcForCrop;
              setCoverCroppedBlob(blob);
              setCoverCropMetadata(cropMetadata);
              if (srcUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(srcUrl);
              }
              setCoverImageSrcForCrop(null);
              setCoverCropOpen(false);
              coverRecropContextRef.current = null;

              if (mode === "edit" && trip?.id) {
                (async () => {
                  try {
                    if (recrop) {
                      if (recrop.existingAssetId) {
                        await updateEditableImageAssetCrop(supabase, {
                          existingAssetId: recrop.existingAssetId,
                          tripId: trip.id,
                          ownerType: "trip_cover",
                          croppedBlob: blob,
                          cropMetadata,
                        });
                      } else {
                        const res = await fetch(srcUrl!);
                        const legacyBlob = await res.blob();
                        const originalFile = new File([legacyBlob], "original.jpg", { type: "image/jpeg" });
                        await saveEditableImageAsset(supabase, {
                          tripId: trip.id,
                          ownerType: "trip_cover",
                          originalFile,
                          croppedBlob: blob,
                          cropMetadata,
                        });
                      }
                    } else if (coverFile) {
                      const existingId = await getExistingEditableAssetId(supabase, trip.id, "trip_cover");
                      await saveEditableImageAsset(supabase, {
                        tripId: trip.id,
                        ownerType: "trip_cover",
                        originalFile: coverFile,
                        croppedBlob: blob,
                        cropMetadata,
                        existingAssetId: existingId,
                      });
                    } else {
                      const path = `${trip.id}/cover.jpg`;
                      const { error: uploadError } = await supabase.storage
                        .from("trip-covers")
                        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
                      if (!uploadError) {
                        await supabase.from("trips").update({ cover_image_path: path }).eq("id", trip.id);
                      }
                    }
                    onSuccess?.();
                    const { data } = await supabase.storage
                      .from("trip-covers")
                      .createSignedUrl(`${trip.id}/cover.jpg`, 3600);
                    if (data?.signedUrl) setExistingCoverSignedUrl(data.signedUrl);
                  } catch (err) {
                    console.error("Cover save failed", err);
                  }
                })();
              }
            }}
          />
        )}

        {avatarImageSrcForCrop && (
          <AvatarCropDialog
            open={avatarCropOpen}
            onOpenChange={handleAvatarCropClose}
            imageSrc={avatarImageSrcForCrop}
            initialCropMetadata={avatarRecropContextRef.current?.cropMetadata ?? undefined}
            onCropComplete={handleAvatarCropComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
