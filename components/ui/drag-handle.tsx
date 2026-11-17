"use client";

import React from "react";
import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";

export interface DragHandleProps {
  /** Spread dnd-kit listeners here so drag starts only from the handle. */
  listeners?: Record<string, unknown>;
  /** Spread dnd-kit attributes (e.g. data attributes for the sortable). */
  attributes?: Record<string, unknown>;
  /** Optional class for the wrapper. */
  className?: string;
  /** Optional aria-label for accessibility. */
  "aria-label"?: string;
}

/**
 * Drag grip for sortable rows (hand-drawn icon).
 * Fine pointers: hidden until row/handle hover, as before.
 * Touch / coarse pointers: hidden; press-and-hold on the row starts the drag instead.
 */
export function DragHandle({
  listeners = {},
  attributes = {},
  className = "",
  "aria-label": ariaLabel = "Drag to reorder",
}: DragHandleProps) {
  return (
    <span
      className={`inline-flex min-h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[#9B7B6B] opacity-80 transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none active:cursor-grabbing [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-70 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100 [@media(pointer:coarse)]:hidden ${className}`}
      role="button"
      aria-label={ariaLabel}
      {...(listeners as Record<string, unknown>)}
      {...(attributes as Record<string, unknown>)}
    >
      <HandDrawnIcon name="drag" size={18} />
    </span>
  );
}
