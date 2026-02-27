"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addTripCurrency,
  removeTripCurrency,
  upsertTripExchangeRate,
  fetchLiveRateToUSD,
} from "@/components/budget/budget-queries";
import { ADDABLE_CURRENCIES, DEFAULT_CURRENCIES } from "@/components/budget/budget-money";

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";

export interface AddCurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  /** Already on trip (from fetchTripCurrencies); these are hidden from the list. */
  existingCurrencies: string[];
  onSuccess: () => void;
}

export function AddCurrencyDialog({
  open,
  onOpenChange,
  tripId,
  existingCurrencies,
  onSuccess,
}: AddCurrencyDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [showManualRateFallback, setShowManualRateFallback] = useState(false);
  const [rateToUSD, setRateToUSD] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = useMemo(
    () => new Set(existingCurrencies.map((c) => c.toUpperCase())),
    [existingCurrencies]
  );

  const filteredList = useMemo(() => {
    const q = search.trim().toUpperCase();
    return ADDABLE_CURRENCIES.filter((c) => {
      if (existingSet.has(c)) return false;
      return !q || c.includes(q);
    });
  }, [search, existingSet]);

  const handleRemoveCurrency = async (currency: string) => {
    if (DEFAULT_CURRENCIES.includes(currency)) return;
    setError(null);
    setSubmitting(true);
    try {
      await removeTripCurrency(tripId, currency);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove currency.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectCurrency = async (currency: string) => {
    setError(null);
    setSelectedCurrency(currency);
    setRateToUSD("");
    setShowManualRateFallback(false);
    setSubmitting(true);
    try {
      if (currency === "USD") {
        await addTripCurrency(tripId, currency);
        onSuccess();
        onOpenChange(false);
        setSelectedCurrency(null);
        return;
      }
      const result = await fetchLiveRateToUSD(currency);
      if ("rate" in result) {
        await addTripCurrency(tripId, currency);
        await upsertTripExchangeRate(tripId, currency, result.rate);
        onSuccess();
        onOpenChange(false);
        setSelectedCurrency(null);
        return;
      }
      if (result.status === 422) {
        setError(result.error || "This currency is not supported by the exchange rate service.");
        setSelectedCurrency(null);
        return;
      }
      if (result.status === 502) {
        setShowManualRateFallback(true);
        setSelectedCurrency(currency);
        setError(null);
      } else {
        setError(result.error || "Failed to add currency.");
        setSelectedCurrency(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add currency.");
      setSelectedCurrency(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRate = async () => {
    if (!selectedCurrency || selectedCurrency === "USD") return;
    const rate = Number(rateToUSD);
    if (Number.isNaN(rate) || rate <= 0) {
      setError("Enter a valid rate (e.g. 0.0067 for JPY).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await addTripCurrency(tripId, selectedCurrency);
      await upsertTripExchangeRate(tripId, selectedCurrency, rate);
      onSuccess();
      onOpenChange(false);
      setSelectedCurrency(null);
      setRateToUSD("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rate.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSearch("");
      setSelectedCurrency(null);
      setShowManualRateFallback(false);
      setRateToUSD("");
      setError(null);
    }
    onOpenChange(open);
  };

  const needsRate =
    showManualRateFallback &&
    selectedCurrency &&
    selectedCurrency !== "USD";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Add currency
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto max-h-[calc(85vh-7rem)] -mx-1 px-1 flex flex-col gap-4">
          {!selectedCurrency ? (
            <>
              <div>
                <p className="text-sm text-[#6B7280] mb-2">Current trip currencies</p>
                <ul className="rounded-[20px] border border-[#ebe5df] bg-[#faf8f6] divide-y divide-[#ebe5df] overflow-hidden mb-4">
                  {existingCurrencies.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-[#6B7280]">
                      None yet (defaults will be used)
                    </li>
                  ) : (
                    existingCurrencies.map((c) => (
                      <li key={c} className="flex items-center justify-between gap-2">
                        <span className="px-4 py-3 text-sm font-medium text-[#1f1f1f]">{c}</span>
                        {DEFAULT_CURRENCIES.includes(c) ? (
                          <span className="px-4 py-3 text-xs text-[#6B7280]">Default</span>
                        ) : (
                          <button
                            type="button"
                            className="px-4 py-3 text-sm font-medium text-red-600 hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset disabled:opacity-50"
                            onClick={() => handleRemoveCurrency(c)}
                            disabled={submitting}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <label htmlFor="add-currency-search" className={labelClass}>
                  Search
                </label>
                <input
                  id="add-currency-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. JPY, GBP"
                  className={`mt-1.5 ${inputClass}`}
                  autoComplete="off"
                />
              </div>
              <div>
                <p className="text-sm text-[#6B7280] mb-2">
                  Select a currency to add to this trip:
                </p>
                <ul className="rounded-[20px] border border-[#ebe5df] bg-[#faf8f6] divide-y divide-[#ebe5df] overflow-hidden">
                  {filteredList.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-[#6B7280]">
                      {existingSet.size >= ADDABLE_CURRENCIES.length
                        ? "All addable currencies are already on this trip."
                        : "No matching currencies."}
                    </li>
                  ) : (
                    filteredList.map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm font-medium text-[#1f1f1f] hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-inset disabled:opacity-50"
                          onClick={() => handleSelectCurrency(c)}
                          disabled={submitting}
                        >
                          {c}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          ) : needsRate ? (
            <>
              <p className="text-sm text-[#4A4A4A]">
                Exchange rate service was unavailable. Enter a rate manually to add {selectedCurrency}:
              </p>
              <div>
                <label htmlFor="add-currency-rate" className={labelClass}>
                  1 {selectedCurrency} = [____] USD
                </label>
                <input
                  id="add-currency-rate"
                  type="number"
                  min="0"
                  step="any"
                  value={rateToUSD}
                  onChange={(e) => setRateToUSD(e.target.value)}
                  placeholder="e.g. 0.0067"
                  className={`mt-1.5 ${inputClass}`}
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-[#e0d9d2] bg-transparent px-4 py-2 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50"
                  onClick={() => {
                    setSelectedCurrency(null);
                    setShowManualRateFallback(false);
                    setRateToUSD("");
                  }}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#d97b5e] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                  onClick={handleSaveRate}
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : selectedCurrency && submitting ? (
            <p className="text-sm text-[#6B7280]">Loading exchange rate…</p>
          ) : null}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
