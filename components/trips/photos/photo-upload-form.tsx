"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export interface PhotoUploadFormProps {
  tripId: string;
  onUploadSuccess?: () => void;
}

async function uploadOnePhoto(
  tripId: string,
  file: File,
  accessToken: string
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/trips/${tripId}/photos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    const msg =
      typeof body.error === "string" && body.error.trim()
        ? body.error.trim()
        : `Upload failed (${res.status}).`;
    throw new Error(msg);
  }
}

export function PhotoUploadForm({ tripId, onUploadSuccess }: PhotoUploadFormProps) {
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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your session expired. Please sign in again.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    for (const file of imageFiles) {
      try {
        await uploadOnePhoto(tripId, file, session.access_token);
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
