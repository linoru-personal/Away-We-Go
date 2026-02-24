"use client";

import { useEffect, useState } from "react";
import {
  createBudgetCategory,
  deleteBudgetCategory,
  fetchBudgetData,
  type BudgetCategorySummary,
  type BudgetData,
} from "@/components/budget/budget-queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLORS = [
  "#E07A5F", // coral
  "#4A90A4", // teal
  "#81B29A", // green
  "#F2CC8F", // sand
  "#E0AFA0", // dusty
  "#9B7B6B", // brown
  "#6B5B95", // purple
  "#5C7A9B", // slate
] as const;

const ICON_KEYS = ["home", "car", "utensils", "compass", "bag", "dots"] as const;
type IconKey = (typeof ICON_KEYS)[number];

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

function IconSymbol({ name, className }: { name: string; className?: string }) {
  const c = className ?? "size-5";
  switch (name) {
    case "home":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "car":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 16H9m10 0h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-1" />
          <path d="M5 16H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1" />
          <path d="M5 10 7 4h10l2 6" />
          <path d="M7 14h.01M17 14h.01" />
        </svg>
      );
    case "utensils":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    case "compass":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case "bag":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "dots":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      );
    default:
      return <span className={c} aria-hidden>•</span>;
  }
}

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
  const [color, setColor] = useState<string>(COLORS[0]);
  const [icon, setIcon] = useState<IconKey>("home");
  const [categories, setCategories] = useState<BudgetCategorySummary[]>(initialCategories);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategories(initialCategories);
      setError(null);
      setName("");
      setColor(COLORS[0]);
      setIcon("home");
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
      await createBudgetCategory(tripId, { name: trimmed, color, icon });
      const data = await fetchBudgetData(tripId);
      setCategories(data.categories);
      onSuccess(data);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setSubmitting(false);
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

        <div className="flex flex-col gap-6">
          {/* Add New Category */}
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div>
              <label htmlFor="category-name" className={labelClass}>
                Category name
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

            <div>
              <p className={labelClass}>Choose Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="size-9 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2"
                    style={{
                      backgroundColor: c,
                      outline: color === c ? "2px solid #1f1f1f" : "none",
                      outlineOffset: 2,
                    }}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={labelClass}>Choose Icon</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="flex size-10 items-center justify-center rounded-xl bg-[#f6f2ed] text-[#1f1f1f] transition hover:bg-[#ebe5df] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2"
                    style={{
                      outline: icon === key ? "2px solid #E07A5F" : "none",
                      outlineOffset: 2,
                    }}
                    onClick={() => setIcon(key)}
                    aria-label={`Icon ${key}`}
                    aria-pressed={icon === key}
                  >
                    <IconSymbol name={key} className="size-5" />
                  </button>
                ))}
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

          {/* Existing Categories */}
          <div>
            <p className={`mb-2 ${labelClass}`}>Existing Categories</p>
            {categories.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No categories yet.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center gap-3 rounded-[20px] bg-[#f6f2ed] px-3 py-2.5"
                  >
                    <div
                      className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-[#1f1f1f]"
                      style={{ backgroundColor: cat.color || "#F5F3F0" }}
                    >
                      <IconSymbol name={cat.icon} className="size-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1f1f]">
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      className="flex flex-shrink-0 items-center justify-center rounded-full p-2 text-[#6B7280] transition hover:bg-[#ebe5df] hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
