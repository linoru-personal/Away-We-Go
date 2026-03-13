"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryIconPicker,
  PLACES_DEFAULT_ICON,
  getIconKey,
  type CategoryIconKey,
} from "@/components/ui/category-icons";

/** Accepts valid Google Maps URLs: maps.app.goo.gl, google.com/maps, maps.google.com, goo.gl/maps */
function isGoogleMapsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes("maps.app.goo.gl") ||
    lower.includes("google.com/maps") ||
    lower.includes("maps.google.com") ||
    lower.includes("goo.gl/maps")
  );
}

/**
 * Extract a human-readable place name from a Google Maps URL if possible.
 * Only parses /place/Name/... style paths; short links (goo.gl, maps.app.goo.gl) return null.
 */
function extractPlaceNameFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/place\/([^/@?#]+)/i);
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    if (decoded.length < 2) return null;
    if (/^[\d.,\s-]+$/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export type PlaceCategory = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type PlaceFormInitialValues = {
  id: string;
  title: string;
  google_maps_url: string;
  notes: string | null;
  category_id: string | null;
};

export interface AddPlaceDialogProps {
  mode: "create" | "edit";
  tripId: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCategoryCreated?: () => void;
  categories: PlaceCategory[];
  initialValues?: PlaceFormInitialValues | null;
}

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

export function AddPlaceDialog({
  mode,
  tripId,
  userId,
  open,
  onOpenChange,
  onSuccess,
  onCategoryCreated,
  categories,
  initialValues,
}: AddPlaceDialogProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [dialogMode, setDialogMode] = useState<"place-form" | "create-category">("place-form");
  const [createCategoryName, setCreateCategoryName] = useState("");
  const [createCategoryIcon, setCreateCategoryIcon] = useState<CategoryIconKey>(PLACES_DEFAULT_ICON);
  const [createCategorySaving, setCreateCategorySaving] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editPlaceId = mode === "edit" ? initialValues?.id ?? null : null;

  useEffect(() => {
    if (open) {
      setError(null);
      setDialogMode("place-form");
      setCreateCategoryName("");
      setCreateCategoryIcon(PLACES_DEFAULT_ICON);
      setCreateCategoryError(null);
      if (mode === "edit" && initialValues) {
        setGoogleMapsUrl(initialValues.google_maps_url);
        setTitle(initialValues.title);
        setNotes(initialValues.notes ?? "");
        setCategoryId(initialValues.category_id ?? "");
      } else {
        setGoogleMapsUrl("");
        setTitle("");
        setNotes("");
        setCategoryId("");
      }
    }
  }, [open, mode, editPlaceId]);

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const urlTrimmed = googleMapsUrl.trim();
    if (!urlTrimmed) {
      setError("Please paste a Google Maps link.");
      return;
    }
    if (!isGoogleMapsUrl(urlTrimmed)) {
      setError("Please enter a valid Google Maps link (e.g. google.com/maps or goo.gl/maps).");
      return;
    }
    const titleToSave = title.trim() || "Place";
    setSaving(true);
    const payload = {
      title: titleToSave,
      google_maps_url: urlTrimmed,
      notes: notes.trim() || null,
      category_id: categoryId.trim() || null,
    };
    if (mode === "edit" && initialValues) {
      const { error: updateError } = await supabase
        .from("trip_places")
        .update(payload)
        .eq("id", initialValues.id);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("trip_places").insert({
        trip_id: tripId,
        added_by_user_id: userId,
        ...payload,
      });
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    onSuccess();
    handleClose();
  };

  const handleCreateCategory = async () => {
    const nameTrimmed = createCategoryName.trim();
    if (!nameTrimmed) {
      setCreateCategoryError("Category name is required.");
      return;
    }
    setCreateCategoryError(null);
    setCreateCategorySaving(true);
    const { data, error: insertError } = await supabase
      .from("trip_place_categories")
      .insert({
        trip_id: tripId,
        name: nameTrimmed,
        icon: createCategoryIcon ?? PLACES_DEFAULT_ICON,
      })
      .select("id")
      .single();
    setCreateCategorySaving(false);
    if (insertError) {
      setCreateCategoryError(insertError.message);
      return;
    }
    if (data?.id) {
      setCategoryId(data.id);
      setCreateCategoryName("");
      setCreateCategoryIcon(PLACES_DEFAULT_ICON);
      setDialogMode("place-form");
      onCategoryCreated?.();
    }
  };

  const handleUrlChange = (value: string) => {
    setGoogleMapsUrl(value);
    setError(null);
    if (!title.trim()) {
      const extracted = extractPlaceNameFromUrl(value);
      if (extracted) setTitle(extracted);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex max-h-[85vh] min-h-0 w-full max-w-[420px] flex-col">
          <div className="shrink-0">
            <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
                {mode === "edit" ? "Edit place" : "Add place"}
              </DialogTitle>
              <p className="mt-1 text-[15px] leading-relaxed text-[#6b6b6b]">
                {mode === "edit"
                  ? "Update the place details below."
                  : "Paste a Google Maps link to save a place for this trip."}
              </p>
            </DialogHeader>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {dialogMode === "create-category" ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <label className={labelClass}>Icon</label>
                      <div className="mt-1.5">
                        <CategoryIconPicker
                          value={createCategoryIcon}
                          onChange={setCreateCategoryIcon}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <label htmlFor="create-place-category-name" className={labelClass}>
                        Category name <span className="text-[#8a8a8a]">(required)</span>
                      </label>
                      <input
                        id="create-place-category-name"
                        type="text"
                        value={createCategoryName}
                        onChange={(e) => setCreateCategoryName(e.target.value)}
                        placeholder="e.g. Restaurants"
                        className={`mt-1.5 ${inputClass}`}
                        disabled={createCategorySaving}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {createCategoryError && (
                    <p className="text-sm text-red-600" role="alert">
                      {createCategoryError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
                      onClick={() => {
                        setDialogMode("place-form");
                        setCreateCategoryName("");
                        setCreateCategoryIcon(PLACES_DEFAULT_ICON);
                        setCreateCategoryError(null);
                      }}
                      disabled={createCategorySaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[#d97b5e] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-60"
                      onClick={handleCreateCategory}
                      disabled={createCategorySaving}
                    >
                      {createCategorySaving ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="add-place-url"
                      className="block text-sm font-medium text-[#1f1f1f]"
                    >
                      Google Maps link <span className="text-[#8a8a8a]">(required)</span>
                    </label>
                    <input
                      id="add-place-url"
                      type="url"
                      placeholder="https://www.google.com/maps/place/..."
                      value={googleMapsUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      disabled={saving}
                      aria-invalid={!!error}
                      className={`mt-1.5 ${inputClass} aria-[invalid=true]:border-red-400`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-place-title"
                      className={labelClass}
                    >
                      Title <span className="text-[#8a8a8a]">(optional)</span>
                    </label>
                    <input
                      id="add-place-title"
                      type="text"
                      placeholder="e.g. Café Central"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={saving}
                      className={`mt-1.5 ${inputClass}`}
                    />
                    <p className="mt-1 text-xs text-[#8a8a8a]">
                      Defaults to &quot;Place&quot; if left blank.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="add-place-category" className={labelClass}>
                      Category <span className="text-[#8a8a8a]">(optional)</span>
                    </label>
                    <select
                      id="add-place-category"
                      value={categoryId}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__create_new__") {
                          setDialogMode("create-category");
                        } else {
                          setCategoryId(v);
                        }
                      }}
                      className={`mt-1.5 ${inputClass}`}
                      disabled={saving}
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__create_new__">+ Create new category</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="add-place-notes"
                      className={labelClass}
                    >
                      Notes <span className="text-[#8a8a8a]">(optional)</span>
                    </label>
                    <textarea
                      id="add-place-notes"
                      rows={2}
                      placeholder="Opening hours, order the..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving}
                      className={`mt-1.5 ${inputClass} resize-none`}
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
            {dialogMode === "place-form" && (
              <div className="mt-4 shrink-0 flex gap-3 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-[#d97b5e] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add place"}
                </button>
              </div>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
