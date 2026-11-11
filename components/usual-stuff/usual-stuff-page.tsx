"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { DASHBOARD_LIST_PAGE_SHELL } from "@/components/trip/dashboard-card-styles";
import { CategoryIcon, PACKING_DEFAULT_ICON } from "@/components/ui/category-icons";
import { DragHandle } from "@/components/ui/drag-handle";
import { GroupedSortableList } from "@/components/ui/grouped-sortable-list";
import type { SortableGroupListSortableProps } from "@/components/ui/sortable-group-list";
import {
  deleteUsualItem,
  insertUsualItem,
  loadMyUsualStuff,
  reorderUsualItems,
  updateUsualItem,
  upsertUsualCategory,
} from "@/lib/usual-stuff/queries";
import type { UsualCategory, UsualItem } from "@/lib/usual-stuff/types";
import { ManageUsualCategoriesDialog } from "./manage-usual-categories-dialog";

const BTN_PRIMARY =
  "rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-60";
const BTN_SECONDARY =
  "rounded-full border border-[#D4C5BA] bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-60";
const BTN_DANGER =
  "rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60";
const GROUP_CARD_CLASS =
  "overflow-hidden rounded-[24px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]";
const ITEM_LIST_CLASS = "divide-y divide-[#F0EBE5]";
const INPUT_CLASS =
  "w-full rounded-[14px] border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#E07A5F] focus:outline-none focus:ring-2 focus:ring-[#E07A5F]/30";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-[#4A4A4A]";
const DEFAULT_CATEGORY_NAME = "General";

type LoadedData = {
  listId: string;
  categories: UsualCategory[];
  items: UsualItem[];
};

type EditorValues = {
  title: string;
  quantity: number;
  categoryId: string;
  person: string | null;
};

/** null = closed; "new" = the add editor; otherwise the id of the item being edited. */
type EditorTarget = null | "new" | string;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function sortItems(items: UsualItem[]): UsualItem[] {
  return [...items].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );
}

/** Puts `ids` into `categoryId` in the given order (local mirror of reorder_usual_items). */
function applyOrder(items: UsualItem[], categoryId: string, ids: string[]): UsualItem[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return items.map((i) => {
    const index = position.get(i.id);
    return index === undefined
      ? i
      : { ...i, category_id: categoryId, sort_order: index };
  });
}

function ItemEditor({
  item,
  categories,
  defaultCategoryId,
  onSave,
  onDelete,
  onCancel,
}: {
  item: UsualItem | null;
  categories: UsualCategory[];
  defaultCategoryId: string;
  onSave: (values: EditorValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [categoryId, setCategoryId] = useState(item?.category_id ?? defaultCategoryId);
  const [person, setPerson] = useState(item?.person_label ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Item name is required.");
      return;
    }
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        quantity: qty,
        categoryId,
        person: person.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save item."));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setError(null);
    setSaving(true);
    try {
      await onDelete();
    } catch (err) {
      setError(errorMessage(err, "Could not delete item."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3 bg-[#FAF6F3] px-4 py-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="usual-title">
          Item
        </label>
        <input
          id="usual-title"
          className={INPUT_CLASS}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Toothbrush"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="usual-qty">
            Quantity
          </label>
          <input
            id="usual-qty"
            type="number"
            min={1}
            className={INPUT_CLASS}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="usual-category">
            Category
          </label>
          {categories.length > 0 ? (
            <select
              id="usual-category"
              className={INPUT_CLASS}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="py-2 text-sm text-[#6b6b6b]">
              Goes in &quot;{DEFAULT_CATEGORY_NAME}&quot; (created for you)
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="usual-person">
            Person
          </label>
          <div className="flex items-center gap-2">
            <input
              id="usual-person"
              className={INPUT_CLASS}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Everyone"
            />
            {person.trim() !== "" && (
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-[#C45C3E] hover:underline"
                onClick={() => setPerson("")}
              >
                Everyone
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        {onDelete && !confirmDelete && (
          <button
            type="button"
            className={`${BTN_DANGER} ml-auto`}
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
        {onDelete && confirmDelete && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-sm text-[#4A4A4A]">Delete this item?</span>
            <button type="button" className={BTN_DANGER} disabled={saving} onClick={handleDelete}>
              Yes, delete
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={saving}
              onClick={() => setConfirmDelete(false)}
            >
              Keep
            </button>
          </span>
        )}
      </div>
    </form>
  );
}

export function UsualStuffPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget>(null);
  const [addCategoryId, setAddCategoryId] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const loaded = await loadMyUsualStuff(supabase);
      setData(loaded);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load your usual stuff."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const itemsByCategory = useMemo(() => {
    if (!data) return [];
    return data.categories.map((category) => ({
      category,
      items: sortItems(data.items.filter((i) => i.category_id === category.id)),
    }));
  }, [data]);

  const openAdd = (categoryId?: string) => {
    setActionError(null);
    setAddCategoryId(categoryId ?? data?.categories[0]?.id ?? "");
    setEditing("new");
  };

  const handleSaveNew = async (values: EditorValues) => {
    if (!data) return;
    let categoryId = values.categoryId;
    if (data.categories.length === 0 || !categoryId) {
      const created = await upsertUsualCategory(supabase, data.listId, {
        name: DEFAULT_CATEGORY_NAME,
        icon: PACKING_DEFAULT_ICON,
      });
      categoryId = created.id;
    }
    await insertUsualItem(supabase, data.listId, {
      category_id: categoryId,
      title: values.title,
      quantity: values.quantity,
      person_label: values.person,
      is_always: false,
    });
    setEditing(null);
    await reload();
  };

  const handleSaveEdit = async (item: UsualItem, values: EditorValues) => {
    if (!data) return;
    const patch: Parameters<typeof updateUsualItem>[2] = {};
    if (values.title !== item.title) patch.title = values.title;
    if (values.quantity !== item.quantity) patch.quantity = values.quantity;
    if (values.person !== item.person_label) patch.person_label = values.person;
    try {
      if (Object.keys(patch).length > 0) {
        await updateUsualItem(supabase, item.id, patch);
      }
      if (values.categoryId !== item.category_id) {
        // Same move as a drag to another category: append to the end of the destination.
        const destIds = sortItems(
          data.items.filter((i) => i.category_id === values.categoryId && i.id !== item.id)
        ).map((i) => i.id);
        await reorderUsualItems(supabase, values.categoryId, [...destIds, item.id]);
      }
    } catch (err) {
      await reload();
      throw err;
    }
    setEditing(null);
    await reload();
  };

  const handleDeleteItem = async (item: UsualItem) => {
    await deleteUsualItem(supabase, item.id);
    setEditing(null);
    await reload();
  };

  const handleToggleStar = async (item: UsualItem) => {
    setActionError(null);
    const next = !item.is_always;
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.id === item.id ? { ...i, is_always: next } : i)),
          }
        : prev
    );
    try {
      await updateUsualItem(supabase, item.id, { is_always: next });
    } catch (err) {
      setActionError(errorMessage(err, "Could not update item."));
      await reload();
    }
  };

  const saveOrder = async (categoryId: string, ids: string[], previous: LoadedData) => {
    setActionError(null);
    setData((prev) =>
      prev ? { ...prev, items: applyOrder(prev.items, categoryId, ids) } : prev
    );
    try {
      await reorderUsualItems(supabase, categoryId, ids);
    } catch (err) {
      setData(previous);
      setActionError(errorMessage(err, "Could not reorder items."));
      await reload();
    }
  };

  const handleReorder = (groupKey: string, newOrdered: UsualItem[]) => {
    if (!data) return Promise.resolve();
    return saveOrder(groupKey, newOrdered.map((i) => i.id), data);
  };

  const handleMove = (
    item: UsualItem,
    _from: string,
    toGroupKey: string,
    insertIndex: number
  ) => {
    if (!data) return Promise.resolve();
    const dest = (itemsByCategory.find(({ category }) => category.id === toGroupKey)?.items ?? [])
      .filter((i) => i.id !== item.id)
      .map((i) => i.id);
    const index = Math.min(Math.max(insertIndex, 0), dest.length);
    dest.splice(index, 0, item.id);
    return saveOrder(toGroupKey, dest, data);
  };

  const renderRow = (item: UsualItem, sortable?: SortableGroupListSortableProps) => {
    if (data && editing === item.id) {
      return (
        <li
          key={item.id}
          ref={sortable?.setNodeRef}
          style={sortable?.style}
          className="list-none"
        >
          <ItemEditor
            item={item}
            categories={data.categories}
            defaultCategoryId={item.category_id}
            onSave={(values) => handleSaveEdit(item, values)}
            onDelete={() => handleDeleteItem(item)}
            onCancel={() => setEditing(null)}
          />
        </li>
      );
    }
    return (
      <li
        key={item.id}
        ref={sortable?.setNodeRef}
        style={sortable?.style}
        className={`group flex list-none items-center gap-1 px-2 ${
          sortable?.isDragging ? "bg-[#F5F3F0]" : ""
        }`}
      >
        {sortable && (
          <DragHandle
            listeners={sortable.listeners}
            attributes={sortable.attributes}
            aria-label="Drag to reorder item"
          />
        )}
        <button
          type="button"
          onClick={() => handleToggleStar(item)}
          aria-pressed={item.is_always}
          aria-label={item.is_always ? "Always pack: on" : "Always pack: off"}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full hover:bg-[#F5F3F0]"
        >
          <Star
            className={`size-5 ${
              item.is_always ? "fill-[#E0A800] text-[#E0A800]" : "text-[#C9BDB3]"
            }`}
            strokeWidth={1.75}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setEditing(item.id);
          }}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#FAF6F3]"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] text-[#1f1f1f]">
            {item.title}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </span>
          <span className="shrink-0 rounded-full bg-[#F0EBE5] px-2.5 py-0.5 text-xs text-[#6B5B50]">
            {item.person_label ?? "Everyone"}
          </span>
        </button>
      </li>
    );
  };

  const renderGroupHeader = (groupKey: string) => {
    const category = data?.categories.find((c) => c.id === groupKey);
    if (!category) return null;
    return (
      <div className="flex items-center gap-2 bg-[#FAF6F3] px-4 py-3">
        <CategoryIcon iconKey={category.icon} className="text-[#6B5B50]" />
        <h2 className="text-base font-semibold text-[#1f1f1f]">{category.name}</h2>
      </div>
    );
  };

  const renderGroupFooter = (groupKey: string) => (
    <div>
      {editing === "new" && addCategoryId === groupKey && data ? (
        <ItemEditor
          item={null}
          categories={data.categories}
          defaultCategoryId={groupKey}
          onSave={handleSaveNew}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => openAdd(groupKey)}
          className="w-full px-4 py-3 text-left text-sm font-medium text-[#C45C3E] hover:bg-[#FAF6F3]"
        >
          + Add item
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={DASHBOARD_LIST_PAGE_SHELL}>
        <p className="text-[#6b6b6b]">Loading…</p>
      </div>
    );
  }

  const isEmpty = !!data && data.categories.length === 0 && data.items.length === 0;

  return (
    <div className={DASHBOARD_LIST_PAGE_SHELL}>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#1f1f1f]">My usual stuff</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Things you pack often. Starred items are pre-selected when you add from usual stuff.
        </p>

        {loadError && (
          <div className="mt-4 space-y-2" role="alert">
            <p className="text-sm text-red-600">{loadError}</p>
            <button type="button" className={BTN_SECONDARY} onClick={() => void reload()}>
              Try again
            </button>
          </div>
        )}

        {actionError && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {actionError}
          </p>
        )}

        {data && (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={BTN_PRIMARY} onClick={() => openAdd()}>
                + Add item
              </button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setManageOpen(true)}>
                Manage categories
              </button>
            </div>

            {isEmpty ? (
              <div className={`${GROUP_CARD_CLASS} mt-6 px-6 py-10 text-center`}>
                <p className="text-[#4A4A4A]">Your usual stuff is empty.</p>
                {editing === "new" ? (
                  <div className="mt-4 text-left">
                    <ItemEditor
                      item={null}
                      categories={data.categories}
                      defaultCategoryId=""
                      onSave={handleSaveNew}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <button type="button" className={BTN_SECONDARY} onClick={() => openAdd()}>
                      + Add item
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <GroupedSortableList<UsualItem>
                  groups={itemsByCategory.map(({ category, items }) => ({
                    groupKey: category.id,
                    items,
                  }))}
                  groupingMeta={{
                    field: "category_id",
                    groupKeyToFieldValue: (k: string) => k,
                  }}
                  onReorder={handleReorder}
                  onMove={handleMove}
                  renderGroupHeader={renderGroupHeader}
                  renderItem={(item, sortable) => renderRow(item, sortable)}
                  renderGroupFooter={renderGroupFooter}
                  listTag="ul"
                  listClassName={ITEM_LIST_CLASS}
                  groupClassName={GROUP_CARD_CLASS}
                />
              </div>
            )}

            <ManageUsualCategoriesDialog
              open={manageOpen}
              onOpenChange={setManageOpen}
              listId={data.listId}
              categories={data.categories}
              items={data.items}
              onSuccess={reload}
            />
          </>
        )}
      </div>
    </div>
  );
}
