"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";

const TRIP_NOTES_BUCKET = "trip-notes";
const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp";

export interface AddTripNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess?: () => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-[#4A4A4A]";

export function AddTripNoteDialog({
  open,
  onOpenChange,
  tripId,
  onSuccess,
}: AddTripNoteDialogProps) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<{ type: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [textContent, setTextContent] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function isValidUrl(s: string): boolean {
    const t = s.trim();
    return t.startsWith("http://") || t.startsWith("https://");
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle("");
      setTagInput("");
      setTags([]);
      setBlocks([]);
      setLinkUrl("");
      setShowLinkInput(false);
      setLinkError(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImageFile(null);
      setImagePreviewUrl(null);
      setTextContent("");
      setShowTextInput(false);
      setError(null);
    }
    onOpenChange(next);
  }

  function addBlock(type: "text" | "list" | "link" | "image") {
    if (type === "link") {
      if (linkUrl.trim()) return;
      setShowLinkInput(true);
      setLinkError(null);
      return;
    }
    if (type === "image") {
      if (imageFile) return;
      imageInputRef.current?.click();
      return;
    }
    if (type === "text") {
      if (showTextInput) return;
      setShowTextInput(true);
      return;
    }
    setBlocks((prev) => [...prev, { type }]);
  }

  function clearText() {
    setTextContent("");
    setShowTextInput(false);
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ACCEPT_IMAGE.split(",").some((t) => file.type === t.trim())) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  function clearLink() {
    setLinkUrl("");
    setShowLinkInput(false);
    setLinkError(null);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    const trimmedLink = linkUrl.trim();
    if (trimmedLink && !isValidUrl(trimmedLink)) {
      setLinkError("URL must start with http:// or https://");
      return;
    }
    setError(null);
    setLinkError(null);
    setSaving(true);
    try {
      let imagePath: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeName = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const path = `${tripId}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(TRIP_NOTES_BUCKET)
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (uploadError) throw uploadError;
        imagePath = path;
      }
      const blocks: (
        | { type: "text"; text: string }
        | { type: "link"; url: string }
        | { type: "image"; path: string; bucket: string }
      )[] = [];
      const trimmedText = textContent.trim();
      if (trimmedText) {
        blocks.push({ type: "text", text: trimmedText });
      }
      if (trimmedLink && isValidUrl(trimmedLink)) {
        blocks.push({ type: "link", url: trimmedLink });
      }
      if (imagePath) {
        blocks.push({ type: "image", path: imagePath, bucket: TRIP_NOTES_BUCKET });
      }
      const content = blocks.length > 0 ? { blocks } : null;
      const { error: insertError } = await supabase.from("trip_notes").insert({
        trip_id: tripId,
        title: trimmedTitle,
        content,
        tags: tags.length > 0 ? tags : null,
      });
      if (insertError) throw insertError;
      handleOpenChange(false);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save note.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = title.trim().length > 0 && !saving;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#4A4A4A]">Add Trip Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-start">
          <div>
            <label className={LABEL_CLASS}>NOTE TITLE *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Things to do in Reykjavik"
              className={INPUT_CLASS}
              disabled={saving}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => addBlock("text")}
                disabled={saving || showTextInput}
              >
                Add Text
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => addBlock("list")}
                disabled={saving}
              >
                Add List
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => addBlock("link")}
                disabled={saving || !!linkUrl.trim()}
              >
                Add Link
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => addBlock("image")}
                disabled={saving || !!imageFile}
              >
                Add Image
              </button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              className="hidden"
              onChange={onImageChange}
              aria-hidden
            />
            {showTextInput && (
              <div className="mt-2 space-y-1">
                <label className={LABEL_CLASS}>Text</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Write a note…"
                  className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                  disabled={saving}
                  rows={3}
                />
                <button
                  type="button"
                  className="text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                  onClick={clearText}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            )}
            {imagePreviewUrl && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3">
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm text-[#4A4A4A]">{imageFile?.name}</p>
                  <button
                    type="button"
                    className="mt-1 text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                    onClick={clearImage}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            {(showLinkInput || linkUrl.trim()) && (
              <div className="mt-2 space-y-1">
                <label className={LABEL_CLASS}>URL</label>
                {linkUrl.trim() ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-[#4A4A4A]">
                      {linkUrl.trim()}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                      onClick={clearLink}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        setLinkError(null);
                      }}
                      placeholder="https://..."
                      className={INPUT_CLASS}
                      disabled={saving}
                    />
                    {linkError && (
                      <p className="text-sm text-red-600" role="alert">
                        {linkError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {blocks.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3 text-start">
                {blocks.map((b, i) => (
                  <div
                    key={i}
                    className="text-sm text-[#6B7280]"
                  >
                    {b.type === "list" && "List block"}
                    {b.type === "image" && "Image block"}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={LABEL_CLASS}>TAGS (OPTIONAL)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag"
                className={INPUT_CLASS}
                disabled={saving}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={addTag}
                disabled={saving}
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F5F3F0] ps-2.5 pe-1.5 py-0.5 text-start text-xs text-[#6B7280]"
                  >
                    {tag}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-[#ebe5df]"
                      onClick={() => removeTag(i)}
                      disabled={saving}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 text-start">
            <button
              type="button"
              className="rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-50"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {saving ? "Adding…" : "Add Note"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
