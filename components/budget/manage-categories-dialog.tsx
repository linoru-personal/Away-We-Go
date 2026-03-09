"use client";

import { useEffect, useState } from "react";
import {
  createBudgetCategory,
  deleteBudgetCategory,
  updateBudgetCategory,
  fetchBudgetData,
  type BudgetCategorySummary,
  type BudgetData,
} from "@/components/budget/budget-queries";
import { normalizeBudgetIcon } from "@/components/budget/budget-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiIconPicker } from "@/components/ui/emoji-icon-picker";
import { CATEGORY_ICON_CHOICES } from "@/components/ui/category-icon-choices";

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

export interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  categories: BudgetCategorySummary[];
  onSuccess: (data: BudgetData) => void;
}

export function ManageCategoriesDialog({
  open,
  onOpenChange,
  tripId,
  categories: initialCategories,
  onSuccess,
}: ManageCategoriesDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(CATEGORY_ICON_CHOICES[0]);
  const [categories, setCategories] = useState<BudgetCategorySummary[]>(initialCategories);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategories(initialCategories);
      setError(null);
      setName("");
      setIcon(CATEGORY_ICON_CHOICES[0]);
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
      await createBudgetCategory(tripId, {
        name: trimmed,
        icon: icon ?? CATEGORY_ICON_CHOICES[0],
      });
      const data = await fetchBudgetData(tripId);
      setCategories(data.categories);
      onSuccess(data);
      setName("");
      setIcon(CATEGORY_ICON_CHOICES[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (cat: BudgetCategorySummary) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon ?? CATEGORY_ICON_CHOICES[0]);
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
      await updateBudgetCategory(tripId, editingId, {
        name: trimmed,
        icon: editIcon ?? undefined,
      });
      const data = await fetchBudgetData(tripId);
      setCategories(data.categories);
      onSuccess(data);
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
      await deleteBudgetCategory(categoryId);
      const data = await fetchBudgetData(tripId);
      setCategories(data.categories);
      onSuccess(data);
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
          {/* List of categories */}
          <div>
            <p className={`mb-2 ${labelClass}`}>Categories</p>
            <ul className="space-y-2" role="list">
              <li className="flex items-center gap-3 rounded-[20px] bg-[#f6f2ed] px-3 py-2.5">
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-lg text-[#1f1f1f]">
                  <span role="img" aria-hidden>💰</span>
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1f1f]">General</span>
              </li>
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
                          <EmojiIconPicker
                            value={editIcon}
                            onChange={(v) => setEditIcon(v)}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <label htmlFor="edit-category-name" className={labelClass}>
                          Name
                        </label>
                        <input
                          id="edit-category-name"
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
                    <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-lg text-[#1f1f1f]">
                      <span role="img" aria-hidden>
                        {normalizeBudgetIcon(cat.icon) ?? "•"}
                      </span>
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

          {/* Add new category */}
          <form onSubmit={handleAdd} className="flex flex-col gap-4 border-t border-[#ebe5df] pt-4">
            <p className={labelClass}>Add new category</p>
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <span className={labelClass}>Icon</span>
                <div className="mt-1.5">
                  <EmojiIconPicker value={icon} onChange={(v) => setIcon(v)} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="category-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Transport"
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
