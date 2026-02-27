"use client";

import { useEffect, useState } from "react";
import {
  createBudgetItem,
  updateBudgetItem,
  type BudgetCategorySummary,
  type BudgetItemRow,
} from "@/components/budget/budget-queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISPLAY_CURRENCIES } from "@/components/budget/budget-money";

const CURRENCIES = DISPLAY_CURRENCIES;

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
  onSuccess: () => void;
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
  defaultCurrency = "USD",
  onSuccess,
}: AddBudgetItemDialogProps) {
  const isEdit = Boolean(existingItem);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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
        DISPLAY_CURRENCIES.includes(defaultCurrency as "ILS" | "USD" | "EUR")
          ? defaultCurrency
          : "USD"
      );
      setCategoryId("");
      setDate("");
      setNotes("");
    }
  }, [open, existingItem, defaultCurrency]);

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
        await updateBudgetItem(existingItem.id, {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            {isEdit ? "Edit Budget Item" : "Add Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto max-h-[calc(85vh-7rem)] -mx-1 px-1">
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
                {CURRENCIES.map((c) => (
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
              onChange={(e) => setCategoryId(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
              disabled={submitting}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
