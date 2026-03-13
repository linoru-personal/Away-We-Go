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
 * Small drag handle (⋮⋮) for sortable rows. Visible on row hover.
 * Put dnd-kit listeners and attributes only on this element so dragging starts from the handle.
 */
export function DragHandle({
  listeners = {},
  attributes = {},
  className = "",
  "aria-label": ariaLabel = "Drag to reorder",
}: DragHandleProps) {
  return (
    <span
      className={`inline-flex shrink-0 cursor-grab touch-none items-center justify-center rounded p-1 text-[#9B7B6B] opacity-0 transition-opacity duration-150 hover:opacity-100 active:cursor-grabbing group-hover:opacity-70 ${className}`}
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
