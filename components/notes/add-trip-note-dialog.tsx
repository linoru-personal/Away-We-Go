"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/app/lib/supabaseClient";

const TRIP_NOTES_BUCKET = "trip-notes";
const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp";

export type TripNoteForModal = {
  id: string;
  trip_id: string;
  title: string;
  content: unknown;
  tags: string[] | null;
  created_at?: string;
  updated_at?: string;
};

function getBlocksFromContent(content: unknown): { type: string; text?: string; items?: string[]; url?: string; path?: string; bucket?: string }[] {
  if (content == null || typeof content !== "object") return [];
  const obj = content as { blocks?: unknown };
  if (!obj.blocks || !Array.isArray(obj.blocks)) return [];
  return obj.blocks as { type: string; text?: string; items?: string[]; url?: string; path?: string; bucket?: string }[];
}

export interface AddTripNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess?: () => void;
  initialNote?: TripNoteForModal | null;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-[#4A4A4A]";

export function AddTripNoteDialog({
  open,
  onOpenChange,
  tripId,
  onSuccess,
  initialNote = null,
}: AddTripNoteDialogProps) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<{ type: string }[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [existingImagePaths, setExistingImagePaths] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [textContent, setTextContent] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [lists, setLists] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!initialNote;

  useEffect(() => {
    if (!open || !initialNote) return;
    setTitle(initialNote.title);
    setTags(initialNote.tags ?? []);
    setTagInput("");
    const contentBlocks = getBlocksFromContent(initialNote.content);
    setLinks([]);
    setExistingImagePaths([]);
    setNewImages((prev) => {
      prev.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      return [];
    });
    setTextContent("");
    setShowTextInput(false);
    setLists([]);
    setError(null);
    const loadedLinks: string[] = [];
    const loadedLists: string[][] = [];
    const loadedPaths: string[] = [];
    for (const b of contentBlocks) {
      if (b.type === "text" && b.text != null) {
        setTextContent(b.text);
        setShowTextInput(true);
      } else if (b.type === "list" && Array.isArray(b.items)) {
        loadedLists.push(b.items.length > 0 ? b.items : [""]);
      } else if (b.type === "link" && b.url) {
        loadedLinks.push(b.url);
      } else if (b.type === "image" && b.path) {
        loadedPaths.push(b.path);
      }
    }
    setLinks(loadedLinks.length > 0 ? loadedLinks : []);
    setLists(loadedLists.length > 0 ? loadedLists : []);
    setExistingImagePaths(loadedPaths);
  }, [open, initialNote?.id]);

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
      setLinks([]);
      setLinkError(null);
      setNewImages((prev) => {
        prev.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        return [];
      });
      setExistingImagePaths([]);
      setTextContent("");
      setShowTextInput(false);
      setLists([]);
      setError(null);
    }
    onOpenChange(next);
  }

  function addBlock(type: "text" | "list" | "link" | "image") {
    if (type === "link") {
      setLinks((prev) => [...prev, ""]);
      setLinkError(null);
      return;
    }
    if (type === "image") {
      imageInputRef.current?.click();
      return;
    }
    if (type === "text") {
      if (showTextInput) return;
      setShowTextInput(true);
      return;
    }
    if (type === "list") {
      setLists((prev) => [...prev, ["", "", ""]]);
      return;
    }
    setBlocks((prev) => [...prev, { type }]);
  }

  function addListItem(listIndex: number) {
    setLists((prev) =>
      prev.map((list, i) =>
        i === listIndex ? [...list, ""] : list
      )
    );
  }

  function setListItem(listIndex: number, itemIndex: number, value: string) {
    setLists((prev) =>
      prev.map((list, i) =>
        i === listIndex
          ? list.map((v, j) => (j === itemIndex ? value : v))
          : list
      )
    );
  }

  function removeListItem(listIndex: number, itemIndex: number) {
    setLists((prev) =>
      prev.map((list, i) =>
        i === listIndex ? list.filter((_, j) => j !== itemIndex) : list
      )
    );
  }

  function removeList(listIndex: number) {
    setLists((prev) => prev.filter((_, i) => i !== listIndex));
  }

  function clearText() {
    setTextContent("");
    setShowTextInput(false);
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ACCEPT_IMAGE.split(",").some((t) => file.type === t.trim())) return;
    setNewImages((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  function removeExistingImage(index: number) {
    setExistingImagePaths((prev) => prev.filter((_, i) => i !== index));
  }

  function setLink(index: number, value: string) {
    setLinks((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
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
    const invalidLinkIndex = links.findIndex((u) => u.trim() && !isValidUrl(u.trim()));
    if (invalidLinkIndex >= 0) {
      setLinkError("URL must start with http:// or https://");
      return;
    }
    setError(null);
    setLinkError(null);
    setSaving(true);
    try {
      const blocks: (
        | { type: "text"; text: string }
        | { type: "list"; items: string[] }
        | { type: "link"; url: string }
        | { type: "image"; path: string; bucket: string }
      )[] = [];
      const trimmedText = textContent.trim();
      if (trimmedText) {
        blocks.push({ type: "text", text: trimmedText });
      }
      for (const listItems of lists) {
        const filtered = listItems
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (filtered.length > 0) {
          blocks.push({ type: "list", items: filtered });
        }
      }
      for (const url of links) {
        const trimmed = url.trim();
        if (trimmed && isValidUrl(trimmed)) {
          blocks.push({ type: "link", url: trimmed });
        }
      }
      for (const path of existingImagePaths) {
        blocks.push({ type: "image", path, bucket: TRIP_NOTES_BUCKET });
      }
      for (const { file } of newImages) {
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const path = `${tripId}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(TRIP_NOTES_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        blocks.push({ type: "image", path, bucket: TRIP_NOTES_BUCKET });
      }
      const content = blocks.length > 0 ? { blocks } : null;
      if (initialNote) {
        const { error: updateError } = await supabase
          .from("trip_notes")
          .update({
            title: trimmedTitle,
            content,
            tags: tags.length > 0 ? tags : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialNote.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("trip_notes").insert({
          trip_id: tripId,
          title: trimmedTitle,
          content,
          tags: tags.length > 0 ? tags : null,
        });
        if (insertError) throw insertError;
      }
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
        <div className="shrink-0">
          <DialogHeader>
            <DialogTitle className="text-[#4A4A4A]">
              {isEditMode ? "Edit Trip Note" : "Add Trip Note"}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto text-start">
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
            <input
              ref={imageInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              className="hidden"
              onChange={onImageChange}
              aria-hidden
            />
            {lists.length > 0 && (
              <div className="mt-2 space-y-4">
                <label className={LABEL_CLASS}>Lists</label>
                {lists.map((listItems, listIndex) => (
                  <div key={listIndex} className="space-y-2 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3">
                    <ul className="space-y-2">
                      {listItems.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => setListItem(listIndex, itemIndex, e.target.value)}
                            placeholder={`Item ${itemIndex + 1}`}
                            className={INPUT_CLASS}
                            disabled={saving}
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-lg border border-[#D4C5BA] bg-white px-2 py-2 text-sm text-[#6B7280] hover:bg-[#F5F3F0] disabled:opacity-50"
                            onClick={() => removeListItem(listIndex, itemIndex)}
                            disabled={saving || listItems.length <= 1}
                            aria-label="Remove item"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[#D4C5BA] bg-white px-3 py-1.5 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-50"
                        onClick={() => addListItem(listIndex)}
                        disabled={saving}
                      >
                        Add item
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                        onClick={() => removeList(listIndex)}
                        disabled={saving}
                      >
                        Remove list
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            {(existingImagePaths.length > 0 || newImages.length > 0) && (
              <div className="mt-2 space-y-2">
                <label className={LABEL_CLASS}>Images</label>
                {existingImagePaths.map((path, index) => (
                  <div
                    key={`existing-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3"
                  >
                    <span className="text-sm text-[#4A4A4A]">Current image</span>
                    <button
                      type="button"
                      className="text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                      onClick={() => removeExistingImage(index)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {newImages.map(({ file, previewUrl }, index) => (
                  <div
                    key={`new-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3"
                  >
                    <img
                      src={previewUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 text-start">
                      <p className="truncate text-sm text-[#4A4A4A]">{file.name}</p>
                      <button
                        type="button"
                        className="mt-1 text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                        onClick={() => removeNewImage(index)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div className="mt-2 space-y-2">
                <label className={LABEL_CLASS}>Links</label>
                {links.map((url, index) => (
                  <div key={index} className="space-y-1">
                    {url.trim() ? (
                      <div className="flex items-center gap-2 rounded-lg border border-[#F5F3F0] bg-[#FAFAF8] p-3">
                        <span className="min-w-0 flex-1 truncate text-sm text-[#4A4A4A]">
                          {url.trim()}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                          onClick={() => removeLink(index)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            setLink(index, e.target.value);
                            setLinkError(null);
                          }}
                          placeholder="https://..."
                          className={INPUT_CLASS}
                          disabled={saving}
                        />
                        <button
                          type="button"
                          className="text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                          onClick={() => removeLink(index)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {linkError && (
                  <p className="text-sm text-red-600" role="alert">
                    {linkError}
                  </p>
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
        </div>

        <div className="shrink-0 flex justify-end gap-2 pt-2 text-start">
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
            {isEditMode
              ? saving
                ? "Saving…"
                : "Save Changes"
              : saving
                ? "Adding…"
                : "Add Note"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
