"use client";

import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";
import {
  PACKING_PRIMARY_BUTTON_CLASS,
  PACKING_SECONDARY_BUTTON_CLASS,
} from "@/components/packing/packing-styles";
import { PackingListMenu } from "@/components/packing/packing-list-menu";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 disabled:opacity-50";

export function PackingToolbar({
  onAddItem,
  onFromUsual,
  searchQuery,
  onSearchChange,
  onManageCategories,
  onDeleteAll,
  canDeleteAll,
  canEdit = true,
}: {
  onAddItem: () => void;
  onFromUsual: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onManageCategories: () => void;
  onDeleteAll: () => void;
  canDeleteAll: boolean;
  /** Read-only viewers get the search box only. */
  canEdit?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {canEdit && (
        <>
          <button
            type="button"
            className={`${PACKING_PRIMARY_BUTTON_CLASS} ${FOCUS} flex-1 md:flex-none`}
            onClick={onAddItem}
          >
            <HandDrawnIcon name="add" size={20} />
            Add item
          </button>
          <button
            type="button"
            className={`${PACKING_SECONDARY_BUTTON_CLASS} ${FOCUS} flex-1 md:flex-none`}
            onClick={onFromUsual}
          >
            <HandDrawnIcon name="usual_stuff" size={20} />
            <span className="md:hidden">From usual stuff</span>
            <span className="hidden md:inline">From my usual stuff</span>
          </button>
        </>
      )}
      <label className="relative ms-auto hidden min-w-0 flex-1 md:block md:max-w-[260px]">
        <span className="sr-only">Find an item</span>
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#7A6A5E]">
          <HandDrawnIcon name="search" size={18} />
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find an item"
          className="h-12 w-full rounded-2xl border-[1.5px] border-[#EFE3D8] bg-white ps-10 pe-3 text-sm text-[#2E2A27] placeholder:text-[#7A6A5E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40"
        />
      </label>
      {canEdit && (
        <div className="hidden md:block">
          <PackingListMenu
            onManageCategories={onManageCategories}
            onDeleteAll={onDeleteAll}
            canDeleteAll={canDeleteAll}
          />
        </div>
      )}
    </div>
  );
}
