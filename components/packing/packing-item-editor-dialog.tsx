"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PackingCategory, PackingItem, PackingParticipant } from "./packing-list";
import { PACKING_PRIMARY_BUTTON_CLASS, PACKING_SECONDARY_BUTTON_CLASS } from "./packing-styles";

/**
 * Edit sheet for one packing item: a bottom sheet on the phone, a centered
 * dialog from md up. It also hosts the delete confirmation, so the row itself
 * needs no inline "Delete? Yes/No".
 */

const FIELD_CLASS =
  "w-full rounded-xl border border-[#E9D5C6] bg-white px-3 py-2.5 text-base text-[#2E2A27] focus:border-[#E07A5F] focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/25 md:text-sm";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-[#6B5B50]";
const FOCUS_RING = "focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none";

export interface PackingItemEditorValues {
  title: string;
  quantity: number;
  categoryId: string;
  assignedTo: string | null;
}

export interface PackingItemEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PackingItem | null;
  categories: PackingCategory[];
  participants: PackingParticipant[];
  saving: boolean;
  error?: string | null;
  onSave: (values: PackingItemEditorValues) => void;
  onDelete: () => void;
  deleting: boolean;
  /** The "Add to my usual stuff" UI, rendered between the fields and the buttons. */
  usualSlot: ReactNode;
  /** Open straight on the delete confirmation (the desktop trash button). */
  initialConfirmDelete?: boolean;
}

function EditorBody({
  item,
  categories,
  participants,
  saving,
  error,
  onSave,
  onDelete,
  onCancel,
  deleting,
  usualSlot,
  initialConfirmDelete,
}: Omit<PackingItemEditorDialogProps, "open" | "onOpenChange" | "item"> & {
  item: PackingItem;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [quantity, setQuantity] = useState(item.quantity);
  const [categoryId, setCategoryId] = useState(item.category_id);
  const [assignedTo, setAssignedTo] = useState<string | null>(item.assigned_to_participant_id);
  const [confirming, setConfirming] = useState(Boolean(initialConfirmDelete));

  if (confirming) {
    return (
      <div>
        <DialogHeader className="pe-10">
          <DialogTitle className="text-lg font-bold text-[#2E2A27]">
            <span dir="auto">{`Delete "${item.title}"?`}</span>
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="mb-3 text-sm text-[#B42318]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`inline-flex h-12 items-center justify-center rounded-2xl bg-[#B42318] px-5 font-bold text-white transition-colors hover:bg-[#9a1d14] disabled:opacity-50 ${FOCUS_RING}`}
            onClick={onDelete}
            disabled={deleting}
          >
            Delete
          </button>
          <button
            type="button"
            className={`${PACKING_SECONDARY_BUTTON_CLASS} ${FOCUS_RING}`}
            // Opened straight on the confirmation (trash button): Cancel closes the dialog.
            // Reached from the edit form: Cancel goes back to it.
            onClick={() => (initialConfirmDelete ? onCancel() : setConfirming(false))}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || saving) return;
        onSave({ title, quantity: quantity >= 1 ? quantity : 1, categoryId, assignedTo });
      }}
    >
      <DialogHeader className="pe-10">
        <DialogTitle className="text-lg font-bold text-[#2E2A27]">Edit item</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="packing-edit-title">
            Name
          </label>
          <input
            id="packing-edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            dir="auto"
            style={{ unicodeBidi: "plaintext" }}
            className={`${FIELD_CLASS} text-left`}
          />
        </div>
        <div className="grid grid-cols-[88px_1fr] gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="packing-edit-quantity">
              Quantity
            </label>
            <input
              id="packing-edit-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="packing-edit-category">
              Category
            </label>
            <select
              id="packing-edit-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={FIELD_CLASS}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="packing-edit-person">
            Person
          </label>
          <select
            id="packing-edit-person"
            value={assignedTo ?? "everyone"}
            onChange={(e) => setAssignedTo(e.target.value === "everyone" ? null : e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="everyone">Everyone</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">{usualSlot}</div>

      {error ? (
        <p className="mt-3 text-sm text-[#B42318]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="submit"
          className={`${PACKING_PRIMARY_BUTTON_CLASS} ${FOCUS_RING} disabled:opacity-50`}
          disabled={saving || !title.trim()}
        >
          Save
        </button>
        <button
          type="button"
          className={`${PACKING_SECONDARY_BUTTON_CLASS} ${FOCUS_RING}`}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`mt-1 self-center rounded-lg px-3 py-2 text-sm font-semibold text-[#B42318] hover:bg-[#FEF3F2] ${FOCUS_RING}`}
          onClick={() => setConfirming(true)}
        >
          Delete item
        </button>
      </div>
    </form>
  );
}

export function PackingItemEditorDialog({
  open,
  onOpenChange,
  item,
  ...rest
}: PackingItemEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        {/* Mounts fresh on every open (DialogContent renders nothing while closed), so the fields start from the item. */}
        {item ? (
          <EditorBody key={item.id} item={item} onCancel={() => onOpenChange(false)} {...rest} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
