"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PackingCategory,
  PackingItem,
  PackingParticipant,
} from "@/components/packing/packing-list";
import {
  UsualStuffPicker,
  type PickerItem,
} from "@/components/usual-stuff/usual-stuff-picker";
import { whoKey, type WhoChoice } from "@/lib/usual-stuff/match";
import {
  addUsualItemsToTrip,
  loadMyUsualStuff,
  sameName,
} from "@/lib/usual-stuff/queries";

export interface AddFromUsualStuffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  categories: PackingCategory[];
  items: PackingItem[];
  participants: PackingParticipant[];
  onRefresh: () => void | Promise<void>;
  onSuccessMessage: (message: string) => void;
}

/** The participant id a person label resolves to; undefined when it is not (yet) a place to add to. */
function resolveParticipantId(
  item: PickerItem,
  who: Record<string, WhoChoice>
): string | null | undefined {
  // Items with no person label, or labelled "Everyone", are shared.
  if (!item.personLabel) return null;
  const choice = who[whoKey(item.personLabel)];
  if (!choice) return undefined;
  if (choice.kind === "participant") return choice.id;
  if (choice.kind === "everyone") return null;
  return undefined; // "skip" or "unset": nothing to compare against
}

function DialogBody({
  tripId,
  categories,
  items,
  participants,
  onRefresh,
  onSuccessMessage,
  onClose,
}: Omit<AddFromUsualStuffDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const [pickerItems, setPickerItems] = useState<PickerItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMyUsualStuff(supabase)
      .then(({ categories: cats, items: usual }) => {
        if (cancelled) return;
        const mapped: PickerItem[] = [];
        for (const cat of cats) {
          for (const it of usual.filter((u) => u.category_id === cat.id)) {
            const label = it.person_label?.trim() ?? "";
            mapped.push({
              key: it.id,
              title: it.title,
              quantity: it.quantity,
              categoryName: cat.name,
              categoryIcon: cat.icon,
              // "Everyone" needs no who's-who row: it stays shared.
              personLabel: label && !sameName(label, "everyone") ? label : null,
              preselected: it.is_always,
            });
          }
        }
        setPickerItems(mapped);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(
          e instanceof Error ? e.message : "Could not load your usual stuff."
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Already on this trip: same title, same-named category, same assigned participant. */
  function isDisabled(
    item: PickerItem,
    who: Record<string, WhoChoice>
  ): string | undefined {
    const participantId = resolveParticipantId(item, who);
    if (participantId === undefined) return undefined;
    const categoryIds = new Set(
      categories.filter((c) => sameName(c.name, item.categoryName)).map((c) => c.id)
    );
    const exists = items.some(
      (t) =>
        sameName(t.title, item.title) &&
        categoryIds.has(t.category_id) &&
        t.assigned_to_participant_id === participantId
    );
    return exists ? "already on this trip" : undefined;
  }

  async function handleConfirm(
    selected: PickerItem[],
    who: Record<string, WhoChoice>
  ) {
    const rows: { usual_item_id: string; participant_id: string | null }[] = [];
    for (const item of selected) {
      const participantId = resolveParticipantId(item, who);
      if (participantId === undefined) {
        // "skip" drops the item; "unset" must never be sent (the picker blocks it).
        const choice = item.personLabel ? who[whoKey(item.personLabel)] : undefined;
        if (choice?.kind === "skip") continue;
        throw new Error("Choose who gets each person's items first.");
      }
      rows.push({ usual_item_id: item.key, participant_id: participantId });
    }
    if (rows.length === 0) return;
    const result = await addUsualItemsToTrip(supabase, tripId, rows);
    await Promise.resolve(onRefresh());
    onSuccessMessage(
      `Added ${result.added} ${result.added === 1 ? "item" : "items"}${
        result.skipped > 0 ? `, ${result.skipped} already there` : ""
      }`
    );
    onClose();
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }
  if (!pickerItems) {
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }
  if (pickerItems.length === 0) {
    return (
      <p className="text-sm text-[#4A4A4A]">
        Your usual stuff is empty.{" "}
        <Link
          href="/dashboard/usual-stuff"
          className="font-medium text-[#E07A5F] hover:text-[#c46950]"
        >
          Set up your usual stuff
        </Link>
      </p>
    );
  }
  return (
    <>
      <UsualStuffPicker
        items={pickerItems}
        who={{ participants }}
        isDisabled={isDisabled}
        confirmLabel={(n) => `Add ${n} item${n === 1 ? "" : "s"}`}
        onConfirm={handleConfirm}
        onCancel={onClose}
      />
      <p className="mt-3 text-center text-sm">
        <Link
          href="/dashboard/usual-stuff"
          className="font-medium text-[#E07A5F] hover:text-[#c46950]"
        >
          Edit my usual stuff
        </Link>
      </p>
    </>
  );
}

export function AddFromUsualStuffDialog({
  open,
  onOpenChange,
  ...rest
}: AddFromUsualStuffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Add from usual stuff
          </DialogTitle>
        </DialogHeader>
        <DialogBody {...rest} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
