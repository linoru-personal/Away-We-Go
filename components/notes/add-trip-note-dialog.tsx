"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle("");
      setTagInput("");
      setTags([]);
      setBlocks([]);
      setError(null);
    }
    onOpenChange(next);
  }

  function addBlock(type: "text" | "list" | "link" | "image") {
    setBlocks((prev) => [...prev, { type }]);
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
    setError(null);
    setSaving(true);
    try {
      const content =
        blocks.length > 0 ? blocks.map((b) => ({ type: b.type })) : null;
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
        <div className="space-y-4">
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
                disabled={saving}
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
                disabled={saving}
              >
                Add Link
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                onClick={() => addBlock("image")}
                disabled={saving}
              >
                Add Image
              </button>
            </div>
            {blocks.length > 0 && (
              <div className="space-y-2 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3">
                {blocks.map((b, i) => (
                  <div
                    key={i}
                    className="text-sm text-[#6B7280]"
                  >
                    {b.type === "text" && "Text block"}
                    {b.type === "list" && "List block"}
                    {b.type === "link" && "Link block"}
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
                    className="inline-flex items-center gap-1 rounded-full bg-[#F5F3F0] pl-2.5 pr-1.5 py-0.5 text-xs text-[#6B7280]"
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

          <div className="flex justify-end gap-2 pt-2">
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
