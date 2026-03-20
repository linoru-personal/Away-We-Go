"use client";

import React from "react";

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
 * Small drag handle (⋮⋮) for sortable rows.
 * On fine pointers with hover: hidden until row/handle hover (desktop).
 * On touch / coarse pointers: always visible with a ~44px tap target (mobile).
 */
export function DragHandle({
  listeners = {},
  attributes = {},
  className = "",
  "aria-label": ariaLabel = "Drag to reorder",
}: DragHandleProps) {
  return (
    <span
      className={`inline-flex min-h-11 min-w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[#9B7B6B] opacity-80 transition-opacity duration-150 active:cursor-grabbing [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-70 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100 ${className}`}
      role="button"
      aria-label={ariaLabel}
      {...(listeners as Record<string, unknown>)}
      {...(attributes as Record<string, unknown>)}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden
      >
        <circle cx="4" cy="4" r="1" />
        <circle cx="8" cy="4" r="1" />
        <circle cx="4" cy="8" r="1" />
        <circle cx="8" cy="8" r="1" />
      </svg>
    </span>
  );
}
