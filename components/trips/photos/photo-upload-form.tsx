"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const BUCKET = "trip-photos";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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
    const file = e.target.files?.[0];
    if (!file) return;

    if (!IMAGE_TYPES.has(file.type)) {
      setError("Please select an image file (JPEG, PNG, GIF, or WebP).");
      e.target.value = "";
      return;
    }

    setUploading(true);
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

      const { error: insertError } = await supabase.from("trip_photos").insert({
        trip_id: tripId,
        added_by_user_id: userId,
        image_path: path,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      e.target.value = "";
      onUploadSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        aria-label="Select image to upload"
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
