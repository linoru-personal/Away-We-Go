"use client";

import {
  PACKING_CARD_CLASS,
  PACKING_PROGRESS_FILL_CLASS,
  PACKING_PROGRESS_TRACK_CLASS,
} from "@/components/packing/packing-styles";

export type PackingPersonProgress = {
  key: string;
  label: string;
  avatarUrl: string | null;
  packed: number;
  total: number;
};

export function PackingPeopleProgress({ people }: { people: PackingPersonProgress[] }) {
  if (people.length === 0) return null;
  return (
    <div className={`${PACKING_CARD_CLASS} p-5`}>
      <h2 className="text-[15px] font-bold text-[#2E2A27]">Who&apos;s packing</h2>
      <ul className="mt-3 space-y-4">
        {people.map((p) => {
          const pct = p.total > 0 ? Math.round((p.packed / p.total) * 100) : 0;
          return (
            <li key={p.key} className="flex items-center gap-3">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FDEDE6] text-xs font-bold text-[#A9432C]"
                  aria-hidden
                >
                  {p.label.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-semibold text-[#2E2A27]">{p.label}</span>
                  <span className="shrink-0 tabular-nums text-[#7A6A5E]" dir="ltr">
                    {p.packed}/{p.total}
                  </span>
                </div>
                <div className={`${PACKING_PROGRESS_TRACK_CLASS} mt-1.5`}>
                  <div className={PACKING_PROGRESS_FILL_CLASS} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
