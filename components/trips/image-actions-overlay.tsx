"use client";

/**
 * Reusable overlay for editable image actions: edit crop, remove, optional replace.
 * Top-right placement, minimal styling, monochrome icons.
 * Matches packing-list / trip-notes-section icon language (inline SVGs).
 * Parent must be position: relative. For showOnHover, parent needs class "group".
 */

/** Pencil icon – same as packing-list PencilIcon (edit). Exported for inline use (e.g. participant row). */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

/** Trash icon – same as packing-list / trip-notes-section TrashIcon. Exported for inline use. */
export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/** Image-plus style icon for replace/change (monochrome). Exported for inline use. */
export function ImagePlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
      <line x1="16" x2="22" y1="5" y2="5" />
      <line x1="19" x2="19" y1="2" y2="8" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

/** Slightly larger on mobile for tap targets; more compact on desktop. */
const iconButtonClass =
  "flex size-7 shrink-0 items-center justify-center rounded-sm text-[#1f1f1f] opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1f1f1f]/25 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none sm:size-6";

export interface ImageActionsOverlayProps {
  /** Edit crop (re-crop) action. */
  onEditCrop?: () => void;
  /** Remove image action. */
  onRemove?: () => void;
  /** Optional replace/change image (e.g. trigger file input). */
  onReplace?: () => void;
  /** Disable all actions (e.g. while saving). */
  disabled?: boolean;
  /** Show overlay only on hover/focus of parent (e.g. for small avatars). */
  showOnHover?: boolean;
  /** Edit crop loading state – show "…" or disable edit button. */
  editLoading?: boolean;
  /** Smaller icons and padding for small previews (e.g. avatar). */
  compact?: boolean;
  className?: string;
}

export function ImageActionsOverlay({
  onEditCrop,
  onRemove,
  onReplace,
  disabled,
  showOnHover,
  editLoading,
  compact,
  className = "",
}: ImageActionsOverlayProps) {
  const base = "absolute flex gap-1 rounded bg-white/50 backdrop-blur-sm ";
  const pos = compact ? "top-0.5 right-0.5 " : "top-1.5 right-1.5 ";
  const pad = compact ? "px-0.5 py-0.5 " : "px-1 py-0.5 ";
  const shadow = compact ? "" : "shadow-[0_1px_2px_rgba(0,0,0,0.06)] ";
  const visibility = showOnHover ? "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 " : "";
  const containerClass = base + pos + pad + shadow + visibility + className;

  const btnClass = compact
    ? "flex size-5 shrink-0 items-center justify-center rounded-sm text-[#1f1f1f] opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1f1f1f]/25 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none"
    : iconButtonClass;
  const iconSize = compact ? "size-3" : "size-3.5 sm:size-3";

  return (
    <div className={containerClass} role="toolbar" aria-label="Image actions">
      {onEditCrop != null && (
        <button
          type="button"
          onClick={onEditCrop}
          disabled={disabled || editLoading}
          className={btnClass}
          aria-label={editLoading ? "Loading" : "Edit crop"}
          title={editLoading ? "Loading…" : "Edit crop"}
        >
          <PencilIcon className={iconSize} />
        </button>
      )}
      {onReplace != null && (
        <button
          type="button"
          onClick={onReplace}
          disabled={disabled}
          className={btnClass}
          aria-label="Change image"
          title="Change image"
        >
          <ImagePlusIcon className={iconSize} />
        </button>
      )}
      {onRemove != null && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={btnClass}
          aria-label="Remove image"
          title="Remove image"
        >
          <TrashIcon className={iconSize} />
        </button>
      )}
    </div>
  );
}
