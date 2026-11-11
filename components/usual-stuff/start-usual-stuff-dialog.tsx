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
import {
  UsualStuffPicker,
  type PickerItem,
} from "@/components/usual-stuff/usual-stuff-picker";
import { PACKING_DEFAULT_ICON } from "@/components/ui/category-icons";
import { fetchTemplates } from "@/lib/packing-templates/queries";
import type { PackingTemplateWithCount } from "@/lib/packing-templates/types";
import { addToMyUsualStuff, sameName } from "@/lib/usual-stuff/queries";
import type { UsualRowInput } from "@/lib/usual-stuff/types";

export interface StartUsualStuffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onSuccessMessage: (message: string) => void;
}

type TripSource = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

type Chosen = { label: string; items: PickerItem[] };

const BTN_SECONDARY =
  "rounded-full border border-[#D4C5BA] bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]";
const SOURCE_ROW =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-[#D4C5BA] bg-white px-3 py-2 text-left text-sm text-[#1f1f1f] hover:bg-[#F5F3F0] disabled:opacity-60";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function formatDates(t: TripSource): string {
  if (t.start_date && t.end_date) return `${t.start_date} to ${t.end_date}`;
  return t.start_date ?? t.end_date ?? "";
}

function byCreatedThenId(
  a: { created_at: string; id: string },
  b: { created_at: string; id: string }
): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

function templateToPickerItems(t: PackingTemplateWithCount): PickerItem[] {
  return [...t.items].sort(byCreatedThenId).map((it) => ({
    key: it.id,
    title: it.name,
    quantity: it.quantity,
    categoryName: it.category?.trim() || "Other",
    categoryIcon: null,
    personLabel: it.assigned_to?.trim() || null,
    preselected: true,
  }));
}

async function loadTripItems(tripId: string): Promise<PickerItem[]> {
  const [catRes, itemsRes, partRes] = await Promise.all([
    supabase
      .from("packing_categories")
      .select("id, name, icon, sort_order")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("packing_items")
      .select("id, category_id, title, quantity, assigned_to_participant_id, sort_order, created_at")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("trip_participants").select("id, name").eq("trip_id", tripId),
  ]);
  if (catRes.error) throw new Error(catRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (partRes.error) throw new Error(partRes.error.message);

  const categories = (catRes.data ?? []) as {
    id: string;
    name: string;
    icon: string | null;
    sort_order: number;
  }[];
  const items = (itemsRes.data ?? []) as {
    id: string;
    category_id: string;
    title: string;
    quantity: number;
    assigned_to_participant_id: string | null;
    sort_order: number;
    created_at: string;
  }[];
  const names = new Map(
    ((partRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
  );

  const out: PickerItem[] = [];
  for (const cat of categories) {
    const inCat = items
      .filter((i) => i.category_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order || byCreatedThenId(a, b));
    for (const it of inCat) {
      out.push({
        key: it.id,
        title: it.title,
        quantity: it.quantity,
        categoryName: cat.name.trim() || "Other",
        categoryIcon: cat.icon,
        personLabel: it.assigned_to_participant_id
          ? names.get(it.assigned_to_participant_id)?.trim() || null
          : null,
        preselected: true,
      });
    }
  }
  return out;
}

function DialogBody({
  onRefresh,
  onSuccessMessage,
  onClose,
}: Omit<StartUsualStuffDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<PackingTemplateWithCount[] | null>(null);
  const [trips, setTrips] = useState<TripSource[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<Chosen | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tpls, tripRes] = await Promise.all([
          fetchTemplates(supabase),
          supabase
            .from("trips")
            .select("id, title, start_date, end_date")
            .order("created_at", { ascending: false }),
        ]);
        if (tripRes.error) throw new Error(tripRes.error.message);
        if (cancelled) return;
        setTemplates(tpls);
        setTrips((tripRes.data ?? []) as TripSource[]);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, "Could not load your trips and templates."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function pick(label: string, load: () => Promise<PickerItem[]>) {
    setBusy(true);
    setLoadError(null);
    try {
      const items = await load();
      setChosen({ label, items });
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load items."));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(selected: PickerItem[]) {
    if (selected.length === 0) return;
    const rows: UsualRowInput[] = selected.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      category_name: i.categoryName,
      category_icon: i.categoryIcon ?? PACKING_DEFAULT_ICON,
      person_label: i.personLabel && !sameName(i.personLabel, "everyone") ? i.personLabel : null,
    }));
    const result = await addToMyUsualStuff(supabase, rows);
    await Promise.resolve(onRefresh());
    const skipped = result.skipped.length;
    onSuccessMessage(
      `Added ${result.added} ${result.added === 1 ? "item" : "items"}${skipped > 0 ? `, ${skipped} already there` : ""}`
    );
    onClose();
  }

  const errorLine = loadError ? (
    <p className="text-sm text-red-600" role="alert">
      {loadError}
    </p>
  ) : null;

  if (chosen) {
    if (chosen.items.length === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-[#4A4A4A]">
            &quot;{chosen.label}&quot; has no items to import.
          </p>
          <button type="button" className={BTN_SECONDARY} onClick={() => setChosen(null)}>
            Back
          </button>
        </div>
      );
    }
    return (
      <UsualStuffPicker
        items={chosen.items}
        confirmLabel={(n) => `Add ${n} item${n === 1 ? "" : "s"}`}
        onConfirm={handleConfirm}
        onCancel={() => setChosen(null)}
      />
    );
  }

  if (!templates) {
    return errorLine ?? <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (templates.length === 0 && trips.length === 0) {
    return (
      <p className="text-sm text-[#4A4A4A]">
        You have no trips or templates yet.{" "}
        <Link
          href="/dashboard/usual-stuff"
          className="font-medium text-[#E07A5F] hover:text-[#c46950]"
          onClick={onClose}
        >
          Back to your usual stuff
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {errorLine}
      {templates.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B5B50]">
            Templates
          </h3>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={SOURCE_ROW}
                  disabled={busy}
                  onClick={() => void pick(t.name, async () => templateToPickerItems(t))}
                >
                  <span className="min-w-0 truncate font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs text-[#6b6b6b]">
                    {t.item_count} item{t.item_count === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {trips.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B5B50]">
            Trips
          </h3>
          <ul className="space-y-2">
            {trips.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={SOURCE_ROW}
                  disabled={busy}
                  onClick={() => void pick(t.title, () => loadTripItems(t.id))}
                >
                  <span className="min-w-0 truncate font-medium">{t.title}</span>
                  <span className="shrink-0 text-xs text-[#6b6b6b]">{formatDates(t)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div>
        <button type="button" className={BTN_SECONDARY} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function StartUsualStuffDialog({
  open,
  onOpenChange,
  ...rest
}: StartUsualStuffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Start from a trip or template
          </DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so state resets on every reopen. */}
        {open && <DialogBody {...rest} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
