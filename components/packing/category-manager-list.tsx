"use client";

import { useState } from "react";
import {
  CategoryIcon,
  CategoryIconPicker,
  PACKING_DEFAULT_ICON,
  getIconKey,
  type CategoryIconKey,
} from "@/components/ui/category-icons";
import { DragHandle } from "@/components/ui/drag-handle";
import { SortableGroupList } from "@/components/ui/sortable-group-list";

const inputClass =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0";
const labelClass = "block text-sm font-medium text-[#1f1f1f]";
const secondaryBtnClass =
  "rounded-full border border-[#e0d9d2] bg-transparent px-3 py-1.5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 disabled:opacity-50";
const primaryBtnClass =
  "rounded-full bg-[#d97b5e] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50";

export type ManagedCategory = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  itemCount: number;
};

export interface CategoryManagerListProps {
  categories: ManagedCategory[];
  onAdd(name: string, icon: CategoryIconKey): Promise<void>;
  onUpdate(id: string, name: string, icon: CategoryIconKey): Promise<void>;
  onReorder(orderedIds: string[]): Promise<void>;
  onDelete(id: string, moveTo: string | null): Promise<void>;
}

export function CategoryManagerList({
  categories,
  onAdd,
  onUpdate,
  onReorder,
  onDelete,
}: CategoryManagerListProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<CategoryIconKey>(PACKING_DEFAULT_ICON);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<CategoryIconKey>(PACKING_DEFAULT_ICON);
  const [editSaving, setEditSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"move" | "delete">("move");
  const [moveToId, setMoveToId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const errMsg = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd(trimmed, icon);
      setName("");
      setIcon(PACKING_DEFAULT_ICON);
    } catch (err) {
      setError(errMsg(err, "Failed to add category."));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (cat: ManagedCategory) => {
    setConfirmDeleteId(null);
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(getIconKey(cat.icon, PACKING_DEFAULT_ICON));
    setEditSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    setError(null);
    setEditSaving(true);
    try {
      await onUpdate(editingId, trimmed, editIcon);
      setEditingId(null);
    } catch (err) {
      setError(errMsg(err, "Failed to update category."));
    } finally {
      setEditSaving(false);
    }
  };

  const startDelete = (cat: ManagedCategory) => {
    const others = categories.filter((c) => c.id !== cat.id);
    setEditingId(null);
    setError(null);
    setConfirmDeleteId(cat.id);
    setDeleteMode(others.length > 0 ? "move" : "delete");
    setMoveToId(others[0]?.id ?? "");
  };

  const handleConfirmDelete = async (cat: ManagedCategory) => {
    const hasOthers = categories.some((c) => c.id !== cat.id);
    const moveTo =
      cat.itemCount > 0 && hasOthers && deleteMode === "move" ? moveToId : null;
    setError(null);
    setDeleting(true);
    try {
      await onDelete(cat.id, moveTo);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(errMsg(err, "Failed to delete category."));
    } finally {
      setDeleting(false);
    }
  };

  const handleReorder = async (ordered: ManagedCategory[]) => {
    setError(null);
    try {
      await onReorder(ordered.map((c) => c.id));
    } catch (err) {
      setError(errMsg(err, "Failed to reorder categories."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`mb-2 ${labelClass}`}>Categories</p>
        <SortableGroupList<ManagedCategory>
          items={categories}
          onReorder={handleReorder}
          disabled={editingId !== null || confirmDeleteId !== null}
          className="space-y-2"
        >
          {(cat, { setNodeRef, style, attributes, listeners, isDragging }) => {
            if (editingId === cat.id) {
              return (
                <li
                  ref={setNodeRef}
                  style={style}
                  key={cat.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-[#e0d9d2] bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <span className={labelClass}>Icon</span>
                      <div className="mt-1.5">
                        <CategoryIconPicker value={editIcon} onChange={setEditIcon} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <label htmlFor="edit-packing-category-name" className={labelClass}>
                        Name
                      </label>
                      <input
                        id="edit-packing-category-name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`mt-1.5 ${inputClass}`}
                        disabled={editSaving}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={secondaryBtnClass}
                      onClick={() => setEditingId(null)}
                      disabled={editSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={primaryBtnClass}
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </li>
              );
            }

            const others = categories.filter((c) => c.id !== cat.id);
            const confirming = confirmDeleteId === cat.id;

            return (
              <li
                ref={setNodeRef}
                style={style}
                key={cat.id}
                className={`group flex flex-col gap-3 rounded-[20px] bg-[#f6f2ed] px-3 py-2.5 ${
                  isDragging ? "relative z-10 shadow-md" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <DragHandle
                    listeners={listeners}
                    attributes={attributes}
                    aria-label={`Drag to reorder ${cat.name}`}
                  />
                  <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-[#1f1f1f]">
                    <CategoryIcon iconKey={getIconKey(cat.icon, PACKING_DEFAULT_ICON)} size={20} />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1f1f]">
                    {cat.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded-full p-2 text-[#6B7280] transition hover:bg-[#ebe5df] hover:text-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                      onClick={() => startEdit(cat)}
                      aria-label={`Edit ${cat.name}`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2 text-[#6B7280] transition hover:bg-[#ebe5df] hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
                      onClick={() => startDelete(cat)}
                      disabled={deleting}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {confirming && (
                  <div className="flex flex-col gap-3 rounded-[16px] border border-[#e0d9d2] bg-white p-3">
                    <p className="text-sm text-[#1f1f1f]">
                      {cat.itemCount === 0
                        ? `Delete "${cat.name}"?`
                        : `Delete "${cat.name}"? It has ${cat.itemCount} ${
                            cat.itemCount === 1 ? "item" : "items"
                          }.`}
                    </p>
                    {cat.itemCount > 0 && (
                      <div className="flex flex-col gap-2 text-sm text-[#1f1f1f]">
                        {others.length > 0 && (
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`delete-mode-${cat.id}`}
                              checked={deleteMode === "move"}
                              onChange={() => setDeleteMode("move")}
                              disabled={deleting}
                            />
                            <span>Move them to</span>
                            <select
                              value={moveToId}
                              onChange={(e) => {
                                setMoveToId(e.target.value);
                                setDeleteMode("move");
                              }}
                              disabled={deleting}
                              aria-label="Move items to category"
                              className="min-w-0 flex-1 rounded-full border border-[#e0d9d2] bg-white px-3 py-1.5 text-sm"
                            >
                              {others.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`delete-mode-${cat.id}`}
                            checked={deleteMode === "delete"}
                            onChange={() => setDeleteMode("delete")}
                            disabled={deleting}
                          />
                          <span>Delete them too</span>
                        </label>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
                        onClick={() => handleConfirmDelete(cat)}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          }}
        </SortableGroupList>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-4 border-t border-[#ebe5df] pt-4">
        <p className={labelClass}>Add new category</p>
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <span className={labelClass}>Icon</span>
            <div className="mt-1.5">
              <CategoryIconPicker value={icon} onChange={setIcon} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="packing-category-name" className={labelClass}>
              Name
            </label>
            <input
              id="packing-category-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Toiletries"
              className={`mt-1.5 ${inputClass}`}
              disabled={submitting}
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-full bg-[#d97b5e] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Adding…" : "Add Category"}
        </button>
      </form>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
