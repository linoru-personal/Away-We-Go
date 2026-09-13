"use client";

import type { ReactNode } from "react";
import type { PackingCategory, PackingItem, PackingParticipant } from "./packing-list";

/**
 * One row of the packing list, and the inline editor that replaces it.
 *
 * The list renders the same row from six places — category/participant view,
 * each in a cross-group drag, a within-group drag, and a read-only variant —
 * so the markup lives here rather than being copied per branch.
 *
 * Rows are flush: the surrounding category card is the only card, and rows are
 * separated by hairlines rather than being cards of their own.
 */

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/** Shared by the editor's inputs and selects. */
const EDITOR_FIELD_CLASS =
  "rounded-xl border border-[#E4DACF] bg-white px-3 py-1.5 text-sm text-[#4A4A4A] focus:border-[#E07A5F] focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/25";

export interface PackingItemEditorProps {
  title: string;
  quantity: number;
  categoryId: string;
  assignedTo: string | null;
  categories: PackingCategory[];
  participants: PackingParticipant[];
  saving: boolean;
  onTitleChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onCategoryChange: (value: string) => void;
  onAssignedToChange: (value: string | null) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PackingItemEditor({
  title,
  quantity,
  categoryId,
  assignedTo,
  categories,
  participants,
  saving,
  onTitleChange,
  onQuantityChange,
  onCategoryChange,
  onAssignedToChange,
  onSave,
  onCancel,
}: PackingItemEditorProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
        className={`min-w-[120px] flex-1 ${EDITOR_FIELD_CLASS}`}
      />
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
        className={`w-16 ${EDITOR_FIELD_CLASS}`}
      />
      <select
        value={categoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
        className={EDITOR_FIELD_CLASS}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={assignedTo ?? "everyone"}
        onChange={(e) => onAssignedToChange(e.target.value === "everyone" ? null : e.target.value)}
        className={EDITOR_FIELD_CLASS}
      >
        <option value="everyone">Everyone</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded-full bg-[#E07A5F] px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-[#D96A4F] disabled:opacity-50"
        onClick={onSave}
        disabled={saving}
      >
        Save
      </button>
      <button
        type="button"
        className="rounded-full border border-[#E4DACF] px-3.5 py-1.5 text-sm font-medium text-[#4A4A4A] transition hover:bg-[#F5F3F0]"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

export interface PackingItemRowProps {
  item: PackingItem;
  /** Secondary line: the assignee in category view, the category in participant view. */
  metaLabel: string;
  /** Whole-list text direction, decided by the parent from the item titles. */
  rtl: boolean;
  canEdit: boolean;
  /** Blocks the checkbox while a toggle elsewhere in the list is failing. */
  toggleDisabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  /** Set while this row is the one awaiting delete confirmation. */
  confirmingDelete: boolean;
  deleteLoading: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  /** Replaces the title, meta and actions while this row is being edited. */
  editor?: ReactNode;
  /** Drag handle; when present the row tightens its leading padding to make room. */
  dragHandle?: ReactNode;
  isDragging?: boolean;
}

export function PackingItemRow({
  item,
  metaLabel,
  rtl,
  canEdit,
  toggleDisabled,
  onToggle,
  onEdit,
  onDeleteRequest,
  confirmingDelete,
  deleteLoading,
  onDeleteConfirm,
  onDeleteCancel,
  editor,
  dragHandle,
  isDragging = false,
}: PackingItemRowProps) {
  const checkboxClass = `flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition ${
    item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
  }`;

  return (
    <div
      className={`flex min-w-0 items-center gap-3 bg-white py-3 pe-4 transition-shadow duration-150 ${
        dragHandle ? "ps-1" : "ps-5"
      } ${isDragging ? "relative z-10 rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : ""}`}
    >
      {dragHandle}

      {canEdit ? (
        <button
          type="button"
          className={`${checkboxClass} active:scale-95`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          disabled={toggleDisabled}
          aria-pressed={item.is_packed}
          aria-label={item.is_packed ? `Mark ${item.title} as not packed` : `Mark ${item.title} as packed`}
        >
          {item.is_packed && <CheckIcon />}
        </button>
      ) : (
        <span className={checkboxClass} aria-hidden>
          {item.is_packed && <CheckIcon />}
        </span>
      )}

      {editor ?? (
        <>
          <div className={`min-w-0 flex-1 ${rtl ? "text-right" : ""}`}>
            <p
              className={`text-[15px] font-medium leading-snug ${
                item.is_packed ? "text-[#B5A79C] line-through" : "text-[#4A4A4A]"
              }`}
              dir={rtl ? "rtl" : "ltr"}
              style={{ unicodeBidi: "plaintext" }}
            >
              {item.title}
            </p>
            <p className="mt-0.5 text-xs text-[#9B7B6B]" dir="ltr">
              {metaLabel}
            </p>
          </div>

          {item.quantity > 1 && (
            <span
              className="shrink-0 text-xs font-medium tabular-nums text-[#9B7B6B]"
              dir="ltr"
              aria-label={`Quantity ${item.quantity}`}
            >
              × {item.quantity}
            </span>
          )}

          {canEdit && (
            <div
              className="flex shrink-0 flex-row items-center gap-0.5"
              dir="ltr"
              onClick={(e) => e.stopPropagation()}
            >
              {confirmingDelete ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs font-medium text-[#6B7280]">Delete?</span>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    onClick={onDeleteConfirm}
                    disabled={deleteLoading}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs font-medium text-[#4A4A4A] transition hover:bg-[#F5F3F0]"
                    onClick={onDeleteCancel}
                  >
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#B5A79C] transition hover:bg-[#F5F3F0] hover:text-[#4A4A4A]"
                    onClick={onEdit}
                    aria-label={`Edit ${item.title}`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#B5A79C] transition hover:bg-[#F5F3F0] hover:text-[#E07A5F]"
                    onClick={onDeleteRequest}
                    aria-label={`Delete ${item.title}`}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
