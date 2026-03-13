"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBudgetItem,
  updateBudgetItem,
  createBudgetCategory,
  type BudgetCategorySummary,
  type BudgetItemRow,
} from "@/components/budget/budget-queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISPLAY_CURRENCIES, DEFAULT_CURRENCIES } from "@/components/budget/budget-money";
import {
  CategoryIcon,
  CategoryIconPicker,
  BUDGET_DEFAULT_ICON,
  getIconKey,
  type CategoryIconKey,
} from "@/components/ui/category-icons";

const CURRENCIES = [...DEFAULT_CURRENCIES];
const DEFAULT_CATEGORY_COLOR = "#E07A5F";

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

export interface AddBudgetItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  categories: BudgetCategorySummary[];
  existingItem?: BudgetItemRow | null;
  /** When opening Add (not Edit), currency dropdown defaults to this (display currency). */
  defaultCurrency?: string;
  /** Trip currencies for the currency dropdown; falls back to DISPLAY_CURRENCIES when not set. */
  tripCurrencies?: string[];
  onSuccess: () => void;
  /** When a new category is created from this dialog, call with the new category so the parent can add it to the list without closing the dialog. */
  onCategoryCreated?: (category: BudgetCategorySummary) => void;
  /** When opening for Add, prefill category (e.g. when adding from a category group). */
  initialCategoryId?: string | null;
  /** When opening for Add, prefill date (YYYY-MM-DD or "" for no date; e.g. when adding from a date group). */
  initialDate?: string | null;
}

function toDateInputValue(date: string | null): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

export function AddBudgetItemDialog({
  open,
  onOpenChange,
  tripId,
  categories,
  existingItem,
  defaultCurrency = "ILS",
  tripCurrencies,
  onSuccess,
  onCategoryCreated,
  initialCategoryId,
  initialDate,
}: AddBudgetItemDialogProps) {
  const isEdit = Boolean(existingItem);
  const currencies =
    tripCurrencies && tripCurrencies.length > 0 ? tripCurrencies : [...DEFAULT_CURRENCIES];

  const [mode, setMode] = useState<"add-item" | "create-category">("add-item");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createCategoryName, setCreateCategoryName] = useState("");
  const [createCategoryIcon, setCreateCategoryIcon] = useState<CategoryIconKey>(BUDGET_DEFAULT_ICON);
  const [createCategorySaving, setCreateCategorySaving] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;
    if (!justOpened) return;
    setError(null);
    setMode("add-item");
    setCreateCategoryError(null);
    setCreateCategoryName("");
    setCreateCategoryIcon(BUDGET_DEFAULT_ICON);
    if (existingItem) {
      setName(existingItem.name);
      setAmount(String(existingItem.amount));
      setCurrency(existingItem.currency);
      setCategoryId(existingItem.category_id ?? "");
      setDate(toDateInputValue(existingItem.date));
      setNotes(existingItem.notes ?? "");
    } else {
      setName("");
      setAmount("");
      setCurrency(
        currencies.includes(defaultCurrency) ? defaultCurrency : currencies[0] ?? "USD"
      );
      setCategoryId(initialCategoryId ?? "");
      setDate(initialDate ?? "");
      setNotes("");
    }
  }, [open, existingItem, defaultCurrency, currencies, initialCategoryId, initialDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError("Item name is required.");
      return;
    }
    const amountNum = Number(amount);
    if (amount === "" || Number.isNaN(amountNum) || amountNum < 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!currency) {
      setError("Currency is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && existingItem) {
        await updateBudgetItem(tripId, existingItem.id, {
          name: nameTrimmed,
          amount: amountNum,
          currency,
          categoryId: categoryId || null,
          date: date || null,
          notes: notes.trim() || null,
        });
      } else {
        await createBudgetItem(tripId, {
          name: nameTrimmed,
          amount: amountNum,
          currency,
          categoryId: categoryId || null,
          date: date || null,
          notes: notes.trim() || null,
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleCreateCategory() {
    const nameTrimmed = createCategoryName.trim();
    if (!nameTrimmed) {
      setCreateCategoryError("Category name is required.");
      return;
    }
    setCreateCategoryError(null);
    setCreateCategorySaving(true);
    try {
      const created = await createBudgetCategory(tripId, {
        name: nameTrimmed,
        color: DEFAULT_CATEGORY_COLOR,
        icon: createCategoryIcon ?? BUDGET_DEFAULT_ICON,
      });
      const newCategory: BudgetCategorySummary = {
        id: created.id,
        name: created.name,
        color: created.color,
        icon: created.icon,
        total_base: 0,
        sort_order: created.sort_order,
      };
      setCategoryId(created.id);
      setCreateCategoryName("");
      setCreateCategoryIcon(BUDGET_DEFAULT_ICON);
      setMode("add-item");
      onCategoryCreated?.(newCategory);
    } catch (err) {
      setCreateCategoryError(err instanceof Error ? err.message : "Failed to create category.");
    } finally {
      setCreateCategorySaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            {mode === "create-category"
              ? "Create category"
              : isEdit
                ? "Edit Budget Item"
                : "Add Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 max-h-[calc(85vh-7rem)] -mx-1 overflow-y-auto px-1">
          {mode === "create-category" ? (
            <div className="flex flex-col gap-4">
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
                  <label htmlFor="create-category-name" className={labelClass}>
                    Category name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="create-category-name"
                    type="text"
                    value={createCategoryName}
                    onChange={(e) => setCreateCategoryName(e.target.value)}
                    placeholder="e.g. Transport"
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
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
                  onClick={() => {
                    setCreateCategoryName("");
                    setCreateCategoryIcon(BUDGET_DEFAULT_ICON);
                    setCreateCategoryError(null);
                    setMode("add-item");
                  }}
                  disabled={createCategorySaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#d97b5e] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                  onClick={handleCreateCategory}
                  disabled={createCategorySaving}
                >
                  {createCategorySaving ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Item Name* */}
          <div>
            <label htmlFor="budget-item-name" className={labelClass}>
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              id="budget-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flight tickets"
              className={`mt-1.5 ${inputClass}`}
              disabled={submitting}
              autoComplete="off"
            />
          </div>

          {/* Amount* + Currency* side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="budget-item-amount" className={labelClass}>
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="budget-item-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={`mt-1.5 ${inputClass}`}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="budget-item-currency" className={labelClass}>
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                id="budget-item-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`mt-1.5 ${inputClass}`}
                disabled={submitting}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category* */}
          <div>
            <label htmlFor="budget-item-category" className={labelClass}>
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="budget-item-category"
              value={categoryId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__create_new__") {
                  setMode("create-category");
                } else {
                  setCategoryId(v);
                }
              }}
              className={`mt-1.5 ${inputClass}`}
              disabled={submitting}
            >
              <option value="">General</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__create_new__">+ Create new category</option>
            </select>
          </div>

          {/* Date (Optional) */}
          <div>
            <label htmlFor="budget-item-date" className={labelClass}>
              Date <span className="font-normal text-[#8a8a8a]">(Optional)</span>
            </label>
            <input
              id="budget-item-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              disabled={submitting}
            />
          </div>

          {/* Notes (Optional) */}
          <div>
            <label htmlFor="budget-item-notes" className={labelClass}>
              Notes <span className="font-normal text-[#8a8a8a]">(Optional)</span>
            </label>
            <textarea
              id="budget-item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className={`mt-1.5 min-h-[80px] resize-y ${inputClass}`}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {/* Footer buttons */}
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#d97b5e] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Saving…" : isEdit ? "Save" : "Add Item"}
            </button>
          </div>
        </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
