"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryIcon,
  CategoryIconPicker,
  PLACES_DEFAULT_ICON,
  getIconKey,
  type CategoryIconKey,
} from "@/components/ui/category-icons";
import type { PlaceCategory } from "@/components/places/add-place-dialog";

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

export interface ManagePlaceCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  categories: PlaceCategory[];
  onSuccess: () => void | Promise<void>;
}

export function ManagePlaceCategoriesDialog({
  open,
  onOpenChange,
  tripId,
  categories: initialCategories,
  onSuccess,
}: ManagePlaceCategoriesDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<CategoryIconKey>(PLACES_DEFAULT_ICON);
  const [categories, setCategories] = useState<PlaceCategory[]>(initialCategories);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<CategoryIconKey>(PLACES_DEFAULT_ICON);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategories(initialCategories);
      setError(null);
      setName("");
      setIcon(PLACES_DEFAULT_ICON);
      setEditingId(null);
    }
  }, [open, initialCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from("trip_place_categories")
        .insert({
          trip_id: tripId,
          name: trimmed,
          icon: icon ?? PLACES_DEFAULT_ICON,
        })
        .select("id, name, icon")
        .single();
      if (insertError) throw new Error(insertError.message);
      setCategories((prev) => [...prev, data as PlaceCategory]);
      await Promise.resolve(onSuccess());
      setName("");
      setIcon(PLACES_DEFAULT_ICON);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (cat: PlaceCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(getIconKey(cat.icon, PLACES_DEFAULT_ICON));
    setEditSaving(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    setError(null);
    setEditSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from("trip_place_categories")
        .update({ name: trimmed, icon: editIcon ?? PLACES_DEFAULT_ICON })
        .eq("id", editingId)
        .eq("trip_id", tripId)
        .select("id, name, icon")
        .single();
      if (updateError) throw new Error(updateError.message);
      setCategories((prev) =>
        prev.map((c) => (c.id === editingId ? (data as PlaceCategory) : c))
      );
      await Promise.resolve(onSuccess());
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setDeletingId(categoryId);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("trip_places")
        .update({ category_id: null })
        .eq("category_id", categoryId);
      if (updateError) throw new Error(updateError.message);
      const { error: deleteError } = await supabase
        .from("trip_place_categories")
        .delete()
        .eq("id", categoryId)
        .eq("trip_id", tripId);
      if (deleteError) throw new Error(deleteError.message);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      await Promise.resolve(onSuccess());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Manage Categories
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
          <div className="flex flex-col gap-6">
            <div>
              <p className={`mb-2 ${labelClass}`}>Categories</p>
              <ul className="space-y-2" role="list">
                {categories.map((cat) =>
                  editingId === cat.id ? (
                    <li
                      key={cat.id}
                      className="flex flex-col gap-3 rounded-[20px] border border-[#e0d9d2] bg-white p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">
                          <span className={labelClass}>Icon</span>
                          <div className="mt-1.5">
                            <CategoryIconPicker
                              value={editIcon}
                              onChange={setEditIcon}
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <label htmlFor="edit-place-category-name" className={labelClass}>
                            Name
                          </label>
                          <input
                            id="edit-place-category-name"
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`mt-1.5 ${inputClass}`}
                            disabled={editSaving}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-[#e0d9d2] bg-transparent px-3 py-1.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
                          onClick={cancelEdit}
                          disabled={editSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-[#d97b5e] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                          onClick={handleSaveEdit}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={cat.id}
                      className="flex items-center gap-3 rounded-[20px] bg-[#f6f2ed] px-3 py-2.5"
                    >
                      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-[#1f1f1f]">
                        <CategoryIcon iconKey={getIconKey(cat.icon, PLACES_DEFAULT_ICON)} size={20} />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1f1f]">
                        {cat.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="rounded-full p-2 text-[#6B7280] transition hover:bg-[#ebe5df] hover:text-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                          onClick={() => startEdit(cat)}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="rounded-full p-2 text-[#6B7280] transition hover:bg-[#ebe5df] hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                          onClick={() => handleDelete(cat.id)}
                          disabled={deletingId === cat.id}
                          aria-label={`Delete ${cat.name}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col gap-4 border-t border-[#ebe5df] pt-4">
              <p className={labelClass}>Add new category</p>
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <span className={labelClass}>Icon</span>
                  <div className="mt-1.5">
                    <CategoryIconPicker value={icon} onChange={setIcon} />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor="place-category-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="place-category-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Restaurants"
                    className={`mt-1.5 ${inputClass}`}
                    disabled={submitting}
                    autoComplete="off"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-full bg-[#d97b5e] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? "Adding…" : "Add Category"}
              </button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditIcon() {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
