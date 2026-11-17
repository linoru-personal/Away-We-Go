"use client";

import { useEffect, useRef, useState } from "react";
import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";
import { PACKING_ICON_BUTTON_CLASS } from "@/components/packing/packing-styles";

export function PackingListMenu({
  onManageCategories,
  onDeleteAll,
  canDeleteAll,
}: {
  onManageCategories: () => void;
  onDeleteAll: () => void;
  canDeleteAll: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "block min-h-[46px] w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold hover:bg-[#FDEDE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="List options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${PACKING_ICON_BUTTON_CLASS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40`}
        onClick={() => setOpen((o) => !o)}
      >
        <HandDrawnIcon name="more" size={22} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-2 w-56 rounded-2xl border border-[#EFE3D8] bg-white p-1.5 shadow-[0_8px_24px_rgba(120,70,40,0.16)]"
        >
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-[#2E2A27]`}
            onClick={() => {
              setOpen(false);
              onManageCategories();
            }}
          >
            Manage categories
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canDeleteAll}
            className={`${itemClass} text-[#B42318]`}
            onClick={() => {
              setOpen(false);
              onDeleteAll();
            }}
          >
            Delete all items…
          </button>
        </div>
      ) : null}
    </div>
  );
}
