"use client";

import type { ReactNode } from "react";
import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";
import type { PackingItem } from "./packing-list";

/**
 * One row of the packing list.
 *
 * The list renders the same row from several places (category/person view,
 * each in a cross-group drag, a within-group drag, and a read-only variant),
 * so the markup lives here rather than being copied per branch.
 *
 * Rows are flush: the surrounding category card is the only card, and rows are
 * separated by hairlines. Editing happens in PackingItemEditorDialog, not here.
 */

const FOCUS_RING = "focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none";

export interface PackingItemRowProps {
  item: PackingItem;
  /** Who the item belongs to; always null for now (no tag in either view). */
  personTag: string | null;
  canEdit: boolean;
  /** Error from the last failed action on this item, shown under the row. */
  error?: string | null;
  onToggle: () => void;
  onOpenEditor: () => void;
  onDeleteRequest: () => void;
  /** Packed row on its way out when packed items are hidden. */
  fading?: boolean;
  /** Drag handle (shown on fine pointers only). */
  dragHandle?: ReactNode;
  isDragging?: boolean;
}

export function PackingItemRow({
  item,
  personTag,
  canEdit,
  error,
  onToggle,
  onOpenEditor,
  onDeleteRequest,
  fading = false,
  dragHandle,
  isDragging = false,
}: PackingItemRowProps) {
  const packed = item.is_packed;
  const boxClass = `flex size-[26px] items-center justify-center rounded-[8px] border-2 md:rounded-[7px] transition-colors md:size-6 ${
    packed ? "border-[#E07A5F] bg-[#E07A5F] text-white" : "border-[#D9C3B3] bg-white"
  }`;
  const box = <span className={boxClass}>{packed && <HandDrawnIcon name="check" size={16} />}</span>;
  const nameClass = `block min-w-0 break-words text-left text-base font-medium leading-snug md:text-[15px] ${
    packed ? "text-[#7A6A5E] line-through" : "text-[#2E2A27]"
  }`;
  const nameStyle = { unicodeBidi: "plaintext" } as const;

  return (
    <div
      // fading: stays fully visible (crossed out) for 3.7 s, then fades out over the last 0.3 s of the
      // 4 s linger. The delay sits on the fading state only, so un-ticking restores it at once.
      className={`group/row border-t border-[#F6EEE7] transition-opacity ${
        packed ? "bg-[#FFFBF7]" : "bg-white"
      } ${fading ? "opacity-0 delay-[3700ms] duration-300" : "duration-500"} ${
        isDragging ? "relative z-10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : ""
      }`}
    >
      <div className="flex min-h-[52px] min-w-0 items-center gap-1 pe-3 ps-1 md:min-h-[50px]">
        {dragHandle}

        {canEdit ? (
          <button
            type="button"
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl active:scale-95 md:size-10 ${FOCUS_RING}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-pressed={packed}
            aria-label={packed ? `Mark ${item.title} as not packed` : `Mark ${item.title} as packed`}
          >
            {box}
          </button>
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center md:size-10" aria-hidden>
            {box}
          </span>
        )}

        <div className="min-w-0 flex-1 ps-1">
          {canEdit ? (
            <button
              type="button"
              className={`block w-full rounded-lg py-3 text-left md:py-2.5 ${FOCUS_RING}`}
              onClick={onOpenEditor}
              aria-label={`Edit ${item.title}`}
            >
              <span dir="auto" style={nameStyle} className={nameClass}>
                {item.title}
              </span>
            </button>
          ) : (
            <p dir="auto" style={nameStyle} className={`${nameClass} py-3 md:py-2.5`}>
              {item.title}
            </p>
          )}
          {personTag ? <p className="-mt-2 pb-2 text-xs text-[#7A6A5E]">{personTag}</p> : null}
        </div>

        {item.quantity > 1 && (
          <span
            className="shrink-0 rounded-full bg-[#FBF1E9] px-2 py-0.5 text-xs font-bold tabular-nums text-[#A9432C]"
            dir="ltr"
            aria-label={`Quantity ${item.quantity}`}
          >
            ×{item.quantity}
          </span>
        )}

        {canEdit && (
          <div
            className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 [@media(pointer:coarse)]:hidden"
            dir="ltr"
          >
            <button
              type="button"
              className={`flex size-[34px] items-center justify-center rounded-full text-[#6B5B50] transition-colors hover:bg-[#FDEDE6] ${FOCUS_RING}`}
              onClick={onOpenEditor}
              aria-label={`Edit ${item.title}`}
            >
              <HandDrawnIcon name="edit" size={18} />
            </button>
            <button
              type="button"
              className={`flex size-[34px] items-center justify-center rounded-full text-[#6B5B50] transition-colors hover:bg-[#FDEDE6] hover:text-[#B42318] ${FOCUS_RING}`}
              onClick={onDeleteRequest}
              aria-label={`Delete ${item.title}`}
            >
              <HandDrawnIcon name="delete" size={18} />
            </button>
          </div>
        )}
      </div>
      {error ? (
        <p className="pb-3 pe-4 ps-5 text-sm text-[#B42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
