"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { getTakenAtFromFile } from "@/lib/trip-photos/exif";

const BUCKET = "trip-photos";

function getExtension(file: File): string {
  const name = file.name;
  const last = name.split(".").pop()?.toLowerCase();
  if (last && /^[a-z0-9]+$/.test(last)) return last;
  const mime = file.type;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export interface PhotoUploadFormProps {
  tripId: string;
  userId: string;
  onUploadSuccess?: () => void;
}

export function PhotoUploadForm({ tripId, userId, onUploadSuccess }: PhotoUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("Please select image files.");
      e.target.value = "";
      return;
    }
    if (imageFiles.length < files.length) {
      setError("Some files were not images and were skipped.");
    }

    setUploading(true);
    const errors: string[] = [];
    for (const file of imageFiles) {
      try {
        const photoId = crypto.randomUUID();
        const ext = getExtension(file);
        const path = `${tripId}/${photoId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const takenAt = await getTakenAtFromFile(file);

        const { error: insertError } = await supabase.from("trip_photos").insert({
          trip_id: tripId,
          added_by_user_id: userId,
          image_path: path,
          taken_at: takenAt ?? null,
        });

        if (insertError) {
          throw new Error(insertError.message);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Upload failed.");
      }
    }

    e.target.value = "";
    setUploading(false);
    if (errors.length > 0) {
      setError(
        errors.length === imageFiles.length
          ? errors[0]
          : `${errors.length} of ${imageFiles.length} uploads failed.`
      );
    }
    if (imageFiles.length > errors.length) {
      onUploadSuccess?.();
      router.refresh();
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Select images to upload"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-full border border-[#ebe5df] bg-white px-4 py-2 text-sm font-medium text-[#2d2d2d] shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Add photo"}
      </button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
