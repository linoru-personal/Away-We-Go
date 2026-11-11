"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { PackingParticipant } from "@/components/packing/packing-list";
import { CategoryIcon } from "@/components/ui/category-icons";
import {
  suggestParticipantId,
  whoKey,
  type WhoChoice,
} from "@/lib/usual-stuff/match";

export type PickerItem = {
  key: string;
  title: string;
  quantity: number;
  categoryName: string;
  categoryIcon: string | null;
  personLabel: string | null;
  preselected: boolean;
  disabledReason?: string;
};

export interface UsualStuffPickerProps {
  /** Already in display order. */
  items: PickerItem[];
  /** Present: render who's-who rows. */
  who?: { participants: PackingParticipant[] };
  /** Re-evaluated whenever a who's-who choice changes. */
  isDisabled?: (
    item: PickerItem,
    who: Record<string, WhoChoice>
  ) => string | undefined;
  confirmLabel: (count: number) => string;
  onConfirm(
    selected: PickerItem[],
    who: Record<string, WhoChoice>
  ): Promise<void>;
  onCancel(): void;
}

const BTN_PRIMARY =
  "rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY =
  "rounded-full border border-[#D4C5BA] bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]";

const UNSET_VALUE = "__unset__";
const EVERYONE_VALUE = "__everyone__";
const SKIP_VALUE = "__skip__";

function choiceToValue(c: WhoChoice): string {
  if (c.kind === "participant") return c.id;
  if (c.kind === "everyone") return EVERYONE_VALUE;
  if (c.kind === "skip") return SKIP_VALUE;
  return UNSET_VALUE;
}

function valueToChoice(v: string): WhoChoice {
  if (v === EVERYONE_VALUE) return { kind: "everyone" };
  if (v === SKIP_VALUE) return { kind: "skip" };
  if (v === UNSET_VALUE) return { kind: "unset" };
  return { kind: "participant", id: v };
}

function CategoryCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 accent-[#E07A5F]"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
    />
  );
}

export function UsualStuffPicker({
  items,
  who,
  isDisabled,
  confirmLabel,
  onConfirm,
  onCancel,
}: UsualStuffPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.preselected).map((i) => i.key))
  );
  /** Only choices the user made; missing keys fall back to the suggestion or "unset" below. */
  const [choices, setChoices] = useState<Record<string, WhoChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participants = who?.participants;

  /** The full who's-who record: one entry per person label in the items. */
  const whoRecord = useMemo(() => {
    const rec: Record<string, WhoChoice> = {};
    if (!participants) return rec;
    for (const item of items) {
      if (!item.personLabel) continue;
      const key = whoKey(item.personLabel);
      if (rec[key]) continue;
      const chosen = choices[key];
      if (chosen) {
        rec[key] = chosen;
        continue;
      }
      const suggested = suggestParticipantId(item.personLabel, participants);
      // No match: nothing is chosen. Never default to Everyone.
      rec[key] = suggested
        ? { kind: "participant", id: suggested }
        : { kind: "unset" };
    }
    return rec;
  }, [items, participants, choices]);

  /** Per item: why it is greyed out (if it is). */
  const reasons = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const item of items) {
      m.set(item.key, item.disabledReason ?? isDisabled?.(item, whoRecord));
    }
    return m;
  }, [items, isDisabled, whoRecord]);

  const active = items.filter(
    (i) => selected.has(i.key) && !reasons.get(i.key)
  );
  /** Items of a person whose choice is "Don't add their items" are not counted and not sent. */
  const countable = active.filter(
    (i) =>
      !(i.personLabel && whoRecord[whoKey(i.personLabel)]?.kind === "skip")
  );
  const count = countable.length;

  const groups = useMemo(() => {
    const out: { name: string; icon: string | null; items: PickerItem[] }[] = [];
    for (const item of items) {
      let g = out.find((x) => x.name === item.categoryName);
      if (!g) {
        g = { name: item.categoryName, icon: item.categoryIcon, items: [] };
        out.push(g);
      }
      g.items.push(item);
    }
    return out;
  }, [items]);

  /** Who's-who rows: distinct labels among the selected (and not greyed out) items. */
  const whoLabels = useMemo(() => {
    const seen = new Map<string, string>();
    if (!participants) return [];
    for (const item of items) {
      if (!item.personLabel) continue;
      if (!selected.has(item.key) || reasons.get(item.key)) continue;
      const key = whoKey(item.personLabel);
      if (!seen.has(key)) seen.set(key, item.personLabel.trim());
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [items, selected, reasons, participants]);

  const unsetLabels = whoLabels.filter(
    (w) => whoRecord[w.key]?.kind === "unset"
  );
  const canConfirm = count > 0 && unsetLabels.length === 0 && !busy;

  function toggleItem(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  function toggleGroup(group: { items: PickerItem[] }) {
    const enabled = group.items.filter((i) => !reasons.get(i.key));
    const allSelected = enabled.every((i) => selected.has(i.key));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of enabled) {
        if (allSelected) next.delete(i.key);
        else next.add(i.key);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(countable, whoRecord);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        {who && whoLabels.length > 0 ? (
          <div className="space-y-2 rounded-2xl bg-[#FBF8F5] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9B7B6B]">
              Who&apos;s who
            </p>
            {whoLabels.map(({ key, label }) => {
              const choice = whoRecord[key] ?? { kind: "unset" as const };
              const isUnset = choice.kind === "unset";
              return (
                <label
                  key={key}
                  className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm text-[#4A4A4A] ${
                    isUnset ? "bg-[#FFF3E0] ring-1 ring-[#E07A5F]" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {label}&apos;s items go to:
                  </span>
                  <select
                    className="shrink-0 rounded-lg border border-[#D4C5BA] bg-white px-2 py-1 text-sm"
                    value={choiceToValue(choice)}
                    onChange={(e) =>
                      setChoices((prev) => ({
                        ...prev,
                        [key]: valueToChoice(e.target.value),
                      }))
                    }
                  >
                    {isUnset ? (
                      <option value={UNSET_VALUE} disabled>
                        Choose…
                      </option>
                    ) : null}
                    {who.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value={EVERYONE_VALUE}>Everyone (shared)</option>
                    <option value={SKIP_VALUE}>Don&apos;t add their items</option>
                  </select>
                </label>
              );
            })}
          </div>
        ) : null}

        {groups.map((group) => {
          const enabled = group.items.filter((i) => !reasons.get(i.key));
          const k = enabled.filter((i) => selected.has(i.key)).length;
          const n = enabled.length;
          return (
            <section key={group.name}>
              <div className="flex items-center gap-2 pb-1">
                <CategoryCheckbox
                  checked={n > 0 && k === n}
                  indeterminate={k > 0 && k < n}
                  disabled={n === 0}
                  onChange={() => toggleGroup(group)}
                  label={`Select all in ${group.name}`}
                />
                <CategoryIcon
                  iconKey={group.icon}
                  size={16}
                  className="text-[#9B7B6B]"
                />
                <h3 className="text-sm font-semibold text-[#4A4A4A]">
                  {group.name}
                </h3>
                <span className="ml-auto text-xs text-[#9B7B6B]">
                  {k} of {n}
                </span>
              </div>
              <ul className="divide-y divide-[#F0EBE5]">
                {group.items.map((item) => {
                  const reason = reasons.get(item.key);
                  return (
                    <li
                      key={item.key}
                      className={`flex items-center gap-2 py-1.5 pl-6 text-sm ${
                        reason ? "text-[#B0A8A0]" : "text-[#4A4A4A]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[#E07A5F]"
                        checked={!reason && selected.has(item.key)}
                        disabled={Boolean(reason)}
                        onChange={() => toggleItem(item.key)}
                        aria-label={item.title}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                        {item.personLabel ? (
                          <span className="text-[#9B7B6B]">
                            {" "}
                            ({item.personLabel})
                          </span>
                        ) : null}
                      </span>
                      {item.preselected ? (
                        <Star
                          className="size-3.5 shrink-0 fill-[#E0A23F] text-[#E0A23F]"
                          aria-label="Always"
                        />
                      ) : null}
                      {reason ? (
                        <span className="shrink-0 text-xs italic">{reason}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {unsetLabels.map((w) => (
          <p key={w.key} className="text-xs text-[#9B7B6B]">
            Choose who gets {w.label}&apos;s items
          </p>
        ))}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {confirmLabel(count)}
          </button>
        </div>
      </div>
    </div>
  );
}
