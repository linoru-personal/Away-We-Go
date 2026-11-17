"use client";

import type { ReactNode } from "react";
import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";
import {
  PACKING_CARD_CLASS,
  PACKING_PROGRESS_FILL_CLASS,
  PACKING_PROGRESS_TRACK_CLASS,
} from "@/components/packing/packing-styles";

/**
 * One group of the packing list (a category, or a person in By person view):
 * a white card whose header shows the icon or avatar, name, packed/total, a
 * thin progress bar and a "+" that adds straight into the group.
 *
 * The header and the "All packed" line are exported on their own too, because
 * the drag-and-drop list draws the card container itself and only takes a
 * header and a footer.
 */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 disabled:opacity-50";

/** The card around a group. Rows inside draw their own top hairline. */
export const PACKING_GROUP_CARD_CLASS = PACKING_CARD_CLASS;

export interface PackingGroupCardHeaderProps {
  /** Icon tile (category) or avatar/initial (person). */
  leading: ReactNode;
  label: string;
  /** Counts over the group's items after the assignee and search filters, before show packed. */
  packed: number;
  total: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Adds an item to this group. Absent for read-only viewers. */
  onAdd?: () => void;
  /** Extra header button, e.g. "Add category to my usual stuff". */
  extraAction?: ReactNode;
  /** Message shown under the header (e.g. an error from extraAction). */
  notice?: ReactNode;
}

export function PackingGroupCardHeader({
  leading,
  label,
  packed,
  total,
  collapsed,
  onToggleCollapsed,
  onAdd,
  extraAction,
  notice,
}: PackingGroupCardHeaderProps) {
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
  return (
    <>
      <div className="flex items-center gap-3 pb-2.5 pe-2.5 ps-4 pt-3.5 md:pb-3 md:pe-3 md:ps-[18px] md:pt-4">
        {/* Icon and name are one control: tapping either folds the group (the "+" never does). */}
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            className={`flex w-full min-w-0 items-center gap-3 rounded-2xl text-start ${FOCUS}`}
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
          >
            {leading}
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span
                  dir="auto"
                  style={{ unicodeBidi: "plaintext" }}
                  className="min-w-0 truncate text-left text-[17px] font-bold text-[#2E2A27]"
                >
                  {label}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#6B5B50]" dir="ltr">
                  {packed}/{total}
                </span>
              </span>
              <span className={`block ${PACKING_PROGRESS_TRACK_CLASS}`} aria-hidden>
                <span className={`block ${PACKING_PROGRESS_FILL_CLASS}`} style={{ width: `${pct}%` }} />
              </span>
            </span>
          </button>
        </h3>
        {extraAction}
        {onAdd ? (
          <button
            type="button"
            className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#FDEDE6] text-[#A9432C] transition-colors hover:bg-[#FBDDD1] md:size-10 md:rounded-xl ${FOCUS}`}
            aria-label={`Add item to ${label}`}
            onClick={onAdd}
          >
            <HandDrawnIcon name="add" size={20} />
          </button>
        ) : null}
      </div>
      {notice}
    </>
  );
}

/** Shown in place of the rows when the group has items but packed ones are hidden and all are packed. */
export function PackingAllPacked() {
  return <p className="border-t border-[#F6EEE7] px-4 pb-3.5 pt-3 text-sm text-[#6B5B50]">All packed</p>;
}

export interface PackingGroupCardProps extends PackingGroupCardHeaderProps {
  /** The rows (and sub-headers). */
  children: ReactNode;
  /** The group has items but none are visible. "All packed" shows unless the group is collapsed. */
  allPacked: boolean;
}

export function PackingGroupCard({ children, allPacked, ...header }: PackingGroupCardProps) {
  return (
    <div className={PACKING_GROUP_CARD_CLASS}>
      <PackingGroupCardHeader {...header} />
      {children}
      {allPacked && !header.collapsed ? <PackingAllPacked /> : null}
    </div>
  );
}
