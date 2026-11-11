"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const labelClass = "block text-sm font-medium text-[#1f1f1f]";
const menuBtnClass =
  "w-full rounded-[20px] bg-[#f6f2ed] px-4 py-3 text-left text-sm font-medium text-[#1f1f1f] transition hover:bg-[#ebe5df] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50";
const BTN_PRIMARY =
  "rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-60";
const BTN_SECONDARY =
  "rounded-full border border-[#D4C5BA] bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-60";

type ManageView = "menu" | "delete-all";

export interface ManagePackingListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  itemCount: number;
  onRefresh: () => Promise<void>;
  onSuccessMessage: (message: string) => void;
}

export function ManagePackingListDialog({
  open,
  onOpenChange,
  tripId,
  itemCount,
  onRefresh,
  onSuccessMessage,
}: ManagePackingListDialogProps) {
  const [view, setView] = useState<ManageView>("menu");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setView("menu");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  function closeDialog() {
    onOpenChange(false);
  }

  function goToMenu() {
    setView("menu");
    setError(null);
  }

  async function handleDeleteAllTripItems() {
    setBusy(true);
    setError(null);
    try {
      console.log("[packing_items.delete]", {
        context: "delete-all-trip-items",
        tripId,
        itemCount,
      });
      const { error: deleteError } = await supabase
        .from("packing_items")
        .delete()
        .eq("trip_id", tripId);

      if (deleteError) throw new Error(deleteError.message);

      await onRefresh();
      onSuccessMessage(
        `Removed all ${itemCount} ${itemCount === 1 ? "item" : "items"} from this trip.`
      );
      closeDialog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete items.");
    } finally {
      setBusy(false);
    }
  }

  const dialogTitle =
    view === "menu"
      ? "Manage packing list"
      : "Delete all items";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setView("menu");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        {view !== "menu" ? (
          <button
            type="button"
            className="-mt-1 mb-2 flex items-center gap-1 text-sm font-medium text-[#6B7280] hover:text-[#4A4A4A]"
            onClick={goToMenu}
            disabled={busy}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </button>
        ) : null}

        {error && view !== "menu" ? (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {view === "menu" ? (
          <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
            <div className="flex flex-col gap-6">
              <section>
                <p className={`mb-2 ${labelClass}`}>This trip</p>
                <p className="mb-3 text-sm text-[#6B7280]">
                  {itemCount} {itemCount === 1 ? "item" : "items"} on this packing
                  list. Categories are kept.
                </p>
                <button
                  type="button"
                  className={`${menuBtnClass} text-red-700 hover:bg-red-50`}
                  disabled={itemCount === 0}
                  onClick={() => setView("delete-all")}
                >
                  Delete all items from this trip
                </button>
              </section>

            </div>
            <div className="mt-6 flex justify-end border-t border-[#ebe5df] pt-4">
              <button type="button" className={BTN_SECONDARY} onClick={closeDialog}>
                Close
              </button>
            </div>
          </div>
        ) : null}

        {view === "delete-all" ? (
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">
              Permanently remove every packing item on this trip ({itemCount}{" "}
              {itemCount === 1 ? "item" : "items"}). Your categories stay
              unchanged.
            </p>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={goToMenu}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                onClick={() => void handleDeleteAllTripItems()}
                disabled={busy || itemCount === 0}
              >
                {busy ? "Deleting…" : "Delete all items"}
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
