"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryIcon,
  CategoryIconPicker,
  PACKING_DEFAULT_ICON,
  getIconKey,
  type CategoryIconKey,
} from "@/components/ui/category-icons";
import { ManagePackingCategoriesDialog } from "@/components/packing/manage-packing-categories-dialog";
import { ManagePackingListDialog } from "@/components/packing/manage-packing-list-dialog";
import {
  SortableGroupList,
  type SortableGroupListSortableProps,
} from "@/components/ui/sortable-group-list";
import { GroupedSortableList } from "@/components/ui/grouped-sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";
import {
  PackingItemEditor,
  PackingItemRow,
} from "@/components/packing/packing-item-row";
import { getPackingGroupingMode, PACKING_GROUP_KEY_EVERYONE } from "@/lib/list-grouping";
import {
  updatePackingItem,
  type PackingItemPatch,
} from "@/lib/packing/packing-item-mutations";

export type PackingCategory = {
  id: string;
  trip_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type PackingItem = {
  id: string;
  trip_id: string;
  category_id: string;
  title: string;
  quantity: number;
  is_packed: boolean;
  assigned_to_participant_id: string | null;
  sort_order: number;
};

export type PackingParticipant = {
  id: string;
  name: string;
};

export interface PackingListProps {
  tripId: string;
  categories: PackingCategory[];
  items: PackingItem[];
  participants: PackingParticipant[];
  /** Avatar URL per participant, same order as participants. Optional; when missing or shorter, no photo is shown. */
  participantAvatarUrls?: (string | null)[];
  /** Cover image URL for the trip; used as the "Everyone" icon in by-participant view. Optional. */
  tripCoverImageUrl?: string | null;
  loading: boolean;
  /** When false (e.g. viewer), hide add/edit/delete/toggle and show read-only list. Default true. */
  canEditContent?: boolean;
  onRefresh: () => Promise<void>;
  /** Apply a local patch after a successful partial DB update (avoids full refetch). */
  onItemsPatched?: (itemId: string, patch: Partial<PackingItem>) => void;
  /** When provided, enables drag-and-drop reorder within each group. Called with items in new order; parent updates state and persists. */
  onReorderGroup?: (newOrderedItems: PackingItem[]) => Promise<void>;
  /** When provided with onReorderGroup, enables moving items across groups. viewMode is the current list view so parent can set the correct field. */
  onMoveItem?: (viewMode: "category" | "participant", item: PackingItem, fromGroupKey: string, toGroupKey: string, insertIndex: number) => Promise<void>;
}

/**
 * One card per group. Rows sit flush inside it, separated by hairlines, so the
 * list reads as a single surface instead of a stack of cards within a card.
 */
const GROUP_CARD_CLASS =
  "overflow-hidden rounded-[24px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

const GROUP_HEADER_CLASS = "flex items-center gap-2.5 px-5 pb-3 pt-4";

/** Hairlines between rows, and one above the first row to close off the header. */
const ITEM_LIST_CLASS = "divide-y divide-[#F0EBE5] border-t border-[#F0EBE5]";

const ADD_ITEM_BUTTON_CLASS =
  "w-full border-t border-[#F0EBE5] px-5 py-3 text-start text-sm font-medium text-[#9B7B6B] transition-colors duration-150 hover:bg-[#FBF8F5] hover:text-[#E07A5F] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E07A5F]/30";

function getAssigneeLabel(item: PackingItem, participants: PackingParticipant[]): string {
  const participantId = item.assigned_to_participant_id;
  if (!participantId) return "Everyone";
  const p = participants.find((x) => x.id === participantId);
  return p?.name ?? "Assigned";
}

function getCategoryName(categoryId: string, categories: PackingCategory[]): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

function getCategoryIcon(categoryId: string, categories: PackingCategory[]): string | null {
  return categories.find((c) => c.id === categoryId)?.icon ?? null;
}

/** True if the string starts with a strong RTL character (e.g. Hebrew, Arabic). */
function isRtlText(s: string): boolean {
  if (!s || !s.trim()) return false;
  const code = (s.trim()[0] ?? "").codePointAt(0) ?? 0;
  return (
    (code >= 0x0590 && code <= 0x05ff) ||
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0xfb1d && code <= 0xfdfd) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

export function PackingList({
  tripId,
  categories,
  items,
  participants,
  participantAvatarUrls = [],
  tripCoverImageUrl,
  loading,
  canEditContent = true,
  onRefresh,
  onItemsPatched,
  onReorderGroup,
  onMoveItem,
}: PackingListProps) {
  const [viewMode, setViewMode] = useState<"category" | "participant">("category");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<"add-item" | "create-category">("add-item");
  const [addTitle, setAddTitle] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addAssignedTo, setAddAssignedTo] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createCategoryName, setCreateCategoryName] = useState("");
  const [createCategoryIcon, setCreateCategoryIcon] = useState<CategoryIconKey>(PACKING_DEFAULT_ICON);
  const [createCategorySaving, setCreateCategorySaving] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  /** When set, opening the add modal will prefill category/assignee from this group key (via grouping meta). */
  const [addPrefillGroupKey, setAddPrefillGroupKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Which list layout (`viewMode`) the user started inline edit from — avoids showing the editor on the wrong branch. */
  const [editSessionView, setEditSessionView] = useState<"category" | "participant" | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const editBaselineRef = useRef<{
    title: string;
    quantity: number;
    category_id: string;
    assigned_to_participant_id: string | null;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [toggleErrorId, setToggleErrorId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageListOpen, setManageListOpen] = useState(false);
  const [listManagementMessage, setListManagementMessage] = useState<string | null>(
    null
  );

  const packedCount = items.filter((i) => i.is_packed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const filteredItems = useMemo(() => {
    if (assigneeFilter === "all") return items;
    return items.filter((i) => {
      const aid = i.assigned_to_participant_id;
      if (assigneeFilter === "everyone") return !aid;
      return aid === assigneeFilter;
    });
  }, [items, assigneeFilter]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category_id) ?? [];
      list.push(item);
      map.set(item.category_id, list);
    }
    const catOrder = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return catOrder.filter((c) => map.has(c.id)).map((c) => ({ category: c, items: map.get(c.id)! }));
  }, [filteredItems, categories]);

  const itemsByParticipant = useMemo(() => {
    const everyone: PackingItem[] = [];
    const byParticipant = new Map<string, PackingItem[]>();
    for (const item of filteredItems) {
      if (!item.assigned_to_participant_id) {
        everyone.push(item);
      } else {
        const list = byParticipant.get(item.assigned_to_participant_id) ?? [];
        list.push(item);
        byParticipant.set(item.assigned_to_participant_id, list);
      }
    }
    const result: { label: string; participantId: string | null; items: PackingItem[] }[] = [
      { label: "Everyone", participantId: null, items: everyone },
    ];
    for (const p of participants) {
      const list = byParticipant.get(p.id) ?? [];
      if (list.length > 0) result.push({ label: p.name, participantId: p.id, items: list });
    }
    return result;
  }, [filteredItems, participants]);

  /** Sticky direction when RTL/LTR count is equal; avoid flipping on tie. */
  const [lastDirection, setLastDirection] = useState<"rtl" | "ltr">("ltr");
  /** Row direction follows the whole trip list, not assignee filter, so layout stays stable per participant chip. */
  const listRtl = useMemo(() => {
    if (items.length === 0) return false;
    const rtlCount = items.filter((item) => isRtlText(item.title)).length;
    const total = items.length;
    const half = total / 2;
    if (rtlCount > half) return true;
    if (rtlCount < half) return false;
    return lastDirection === "rtl";
  }, [items, lastDirection]);
  useEffect(() => {
    if (items.length === 0) return;
    const rtlCount = items.filter((item) => isRtlText(item.title)).length;
    const total = items.length;
    const half = total / 2;
    if (rtlCount > half) setLastDirection("rtl");
    else if (rtlCount < half) setLastDirection("ltr");
  }, [items]);

  async function handleTogglePacked(item: PackingItem) {
    setToggleErrorId(null);
    const next = !item.is_packed;

    const { error } = await updatePackingItem(
      supabase,
      item.id,
      { is_packed: next },
      "toggle-packed"
    );

    if (error) {
      setToggleErrorId(item.id);
      return;
    }
    onItemsPatched?.(item.id, { is_packed: next });
  }

  async function handleCreateCategory() {
    const name = createCategoryName.trim();
    if (!name) {
      setCreateCategoryError("Category name is required.");
      return;
    }
    setCreateCategoryError(null);
    setCreateCategorySaving(true);
    const sortOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order)) + 1
        : 0;
    const { data, error } = await supabase
      .from("packing_categories")
      .insert({
        trip_id: tripId,
        name,
        icon: createCategoryIcon ?? PACKING_DEFAULT_ICON,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    setCreateCategorySaving(false);
    if (error) {
      setCreateCategoryError(error.message);
      return;
    }
    const newId = data?.id;
    if (newId) {
      setAddCategoryId(newId);
      setCreateCategoryName("");
      setCreateCategoryIcon(PACKING_DEFAULT_ICON);
      setAddModalMode("add-item");
      await onRefresh();
    }
  }

  async function handleAddItem() {
    const title = addTitle.trim();
    if (!title) {
      setAddError("Title is required.");
      return;
    }
    if (!addCategoryId) {
      setAddError("Category is required.");
      return;
    }
    setAddError(null);
    setAddSaving(true);
    const insertRow = {
      trip_id: tripId,
      category_id: addCategoryId,
      title,
      quantity: addQuantity >= 1 ? addQuantity : 1,
      is_packed: false,
      assigned_to_participant_id: addAssignedTo ?? null,
    };
    console.log("[packing_items.insert]", insertRow);
    const { error } = await supabase.from("packing_items").insert(insertRow);
    setAddSaving(false);
    if (error) {
      setAddError(error.message);
      return;
    }
    setAddTitle("");
    setAddQuantity(1);
    setAddCategoryId(categories[0]?.id ?? "");
    setAddAssignedTo(null);
    setAddModalOpen(false);
    await onRefresh();
  }

  useEffect(() => {
    if (!addModalOpen || !addPrefillGroupKey || !canEditContent) return;
    const meta = getPackingGroupingMode(viewMode);
    const value = meta.groupKeyToFieldValue(addPrefillGroupKey);
    if (meta.field === "category_id") {
      setAddCategoryId(String(value ?? ""));
    } else {
      setAddAssignedTo(value as string | null);
      setAddCategoryId((prev) =>
        typeof prev === "string" && prev.trim() !== "" ? prev : categories[0]?.id ?? ""
      );
    }
    setAddPrefillGroupKey(null);
  }, [addModalOpen, addPrefillGroupKey, viewMode, canEditContent, categories]);

  useEffect(() => {
    setEditingId(null);
    setEditSessionView(null);
  }, [viewMode]);

  function clearInlineEdit() {
    setEditingId(null);
    setEditSessionView(null);
    editBaselineRef.current = null;
  }

  function openEdit(item: PackingItem) {
    setEditingId(item.id);
    setEditSessionView(viewMode);
    setEditTitle(item.title);
    setEditQuantity(item.quantity);
    setEditCategoryId(item.category_id);
    setEditAssignedTo(item.assigned_to_participant_id);
    editBaselineRef.current = {
      title: item.title,
      quantity: item.quantity,
      category_id: item.category_id,
      assigned_to_participant_id: item.assigned_to_participant_id,
    };
  }

  function openAddFromGroup(groupKey: string) {
    setAddPrefillGroupKey(groupKey);
    setAddModalMode("add-item");
    setAddCategoryId((prev) => (typeof prev === "string" && prev.trim() !== "" ? prev : categories[0]?.id ?? ""));
    setAddModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const baseline = editBaselineRef.current;
    if (!baseline) return;

    const title = editTitle.trim();
    if (!title) return;

    const quantity = editQuantity >= 1 ? editQuantity : 1;
    const patch: PackingItemPatch = {};

    if (title !== baseline.title) patch.title = title;
    if (quantity !== baseline.quantity) patch.quantity = quantity;
    if (editCategoryId !== baseline.category_id) patch.category_id = editCategoryId;

    const nextAssigned = editAssignedTo ?? null;
    if (nextAssigned !== baseline.assigned_to_participant_id) {
      patch.assigned_to_participant_id = nextAssigned;
    }

    if (Object.keys(patch).length === 0) {
      clearInlineEdit();
      return;
    }

    setEditSaving(true);
    const { error } = await updatePackingItem(
      supabase,
      editingId,
      patch,
      "save-edit"
    );
    setEditSaving(false);
    if (error) return;

    onItemsPatched?.(editingId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.category_id !== undefined ? { category_id: patch.category_id } : {}),
      ...(patch.assigned_to_participant_id !== undefined
        ? { assigned_to_participant_id: patch.assigned_to_participant_id }
        : {}),
    });

    clearInlineEdit();
  }

  async function handleDelete(itemId: string) {
    setDeleteLoading(true);
    const { error } = await supabase.from("packing_items").delete().eq("id", itemId);
    setDeleteLoading(false);
    setDeleteConfirmId(null);
    if (error) return;
    if (editingId === itemId) clearInlineEdit();
    await onRefresh();
  }

  /** LTR + stable order: list rows may use `dir="rtl"` for titles, which reverses flex and breaks "Delete?". */
  /** Avatar for a participant group; the trip cover stands in for "Everyone". */
  function getParticipantAvatarUrl(participantId: string | null): string | null {
    if (participantId === null) return tripCoverImageUrl ?? null;
    const idx = participants.findIndex((p) => p.id === participantId);
    return idx >= 0 ? participantAvatarUrls[idx] ?? null : null;
  }

  /** "4/7" for a group, counted over the items actually shown (so it respects the filter). */
  function renderGroupCount(groupItems: PackingItem[]) {
    const packed = groupItems.filter((i) => i.is_packed).length;
    return (
      <span className="shrink-0 text-sm font-medium tabular-nums text-[#9B7B6B]" dir="ltr">
        {packed}/{groupItems.length}
      </span>
    );
  }

  function renderCategoryHeader(category: PackingCategory, groupItems: PackingItem[]) {
    return (
      <div className={GROUP_HEADER_CLASS}>
        <span className="shrink-0 text-[#4A4A4A]">
          <CategoryIcon iconKey={getIconKey(category.icon, PACKING_DEFAULT_ICON)} size={20} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[#4A4A4A]">
          {category.name}
        </h3>
        {renderGroupCount(groupItems)}
      </div>
    );
  }

  function renderParticipantHeader(
    label: string,
    avatarUrl: string | null,
    groupItems: PackingItem[]
  ) {
    return (
      <div className={GROUP_HEADER_CLASS}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            className="size-8 shrink-0 rounded-full object-cover"
            aria-hidden
          />
        ) : (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E8E4E0] text-sm font-medium text-[#6B7280]"
            aria-hidden
          >
            {label.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
        )}
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[#4A4A4A]">{label}</h3>
        {renderGroupCount(groupItems)}
      </div>
    );
  }

  function renderAddItemButton(groupKey: string) {
    return (
      <button type="button" className={ADD_ITEM_BUTTON_CLASS} onClick={() => openAddFromGroup(groupKey)}>
        + Add item
      </button>
    );
  }

  /**
   * A single list row. Both view modes and all three drag states route through
   * here, so the row markup has one home.
   */
  function renderItemRow(
    item: PackingItem,
    metaLabel: string,
    dragHandle?: React.ReactNode,
    isDragging?: boolean
  ) {
    const isEditing = editingId === item.id && editSessionView === viewMode && canEditContent;
    return (
      <PackingItemRow
        item={item}
        metaLabel={metaLabel}
        rtl={listRtl}
        canEdit={canEditContent}
        toggleDisabled={!!toggleErrorId}
        onToggle={() => handleTogglePacked(item)}
        onEdit={() => openEdit(item)}
        onDeleteRequest={() => setDeleteConfirmId(item.id)}
        confirmingDelete={deleteConfirmId === item.id}
        deleteLoading={deleteLoading}
        onDeleteConfirm={() => handleDelete(item.id)}
        onDeleteCancel={() => setDeleteConfirmId(null)}
        dragHandle={dragHandle}
        isDragging={isDragging}
        editor={
          isEditing ? (
            <PackingItemEditor
              title={editTitle}
              quantity={editQuantity}
              categoryId={editCategoryId}
              assignedTo={editAssignedTo}
              categories={categories}
              participants={participants}
              saving={editSaving}
              onTitleChange={setEditTitle}
              onQuantityChange={setEditQuantity}
              onCategoryChange={setEditCategoryId}
              onAssignedToChange={setEditAssignedTo}
              onSave={handleSaveEdit}
              onCancel={() => clearInlineEdit()}
            />
          ) : undefined
        }
      />
    );
  }

  /** The same row, wrapped as a dnd-kit sortable `<li>`. */
  function renderSortableRow(
    item: PackingItem,
    { setNodeRef, style, attributes, listeners, isDragging }: SortableGroupListSortableProps,
    metaLabel: string
  ) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="group list-none"
        dir={listRtl ? "rtl" : undefined}
      >
        {renderItemRow(
          item,
          metaLabel,
          canEditContent ? (
            <DragHandle
              listeners={listeners}
              attributes={attributes}
              aria-label="Drag to reorder item"
            />
          ) : undefined,
          isDragging
        )}
      </li>
    );
  }

  if (loading) {
    return (
      <div className="mt-8">
        <p className="text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div>
        <h2 className="text-2xl font-bold text-[#4A4A4A]">Packing</h2>
        <p className="mt-0.5 text-sm text-[#9B7B6B]">
          {canEditContent ? "List progress" : "Read-only — you can view but not edit"}
        </p>
      </div>

      <ManagePackingCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        tripId={tripId}
        categories={categories}
        onSuccess={onRefresh}
      />

      <ManagePackingListDialog
        open={manageListOpen}
        onOpenChange={setManageListOpen}
        tripId={tripId}
        itemCount={items.length}
        categories={categories}
        items={items}
        participants={participants}
        onRefresh={onRefresh}
        onSuccessMessage={setListManagementMessage}
      />

      {listManagementMessage ? (
        <div
          className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-sm text-[#2e7d32]"
          role="status"
        >
          <span>{listManagementMessage}</span>
          <button
            type="button"
            className="shrink-0 text-[#2e7d32]/70 hover:text-[#2e7d32]"
            aria-label="Dismiss"
            onClick={() => setListManagementMessage(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-2xl font-semibold text-[#E07A5F]">{progressPercent}%</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F5F3F0]">
        <div
          className="h-full rounded-full bg-[#E07A5F] transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            viewMode === "category"
              ? "border-[#E07A5F] bg-[#E07A5F] text-white"
              : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
          }`}
          onClick={() => setViewMode("category")}
        >
          By Category
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            viewMode === "participant"
              ? "border-[#E07A5F] bg-[#E07A5F] text-white"
              : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
          }`}
          onClick={() => setViewMode("participant")}
        >
          By Participant
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${
            assigneeFilter === "all"
              ? "bg-[#E07A5F] text-white"
              : "bg-[#F5F3F0] text-[#4A4A4A] hover:bg-[#E8E4E0]"
          }`}
          onClick={() => setAssigneeFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${
            assigneeFilter === "everyone"
              ? "bg-[#E07A5F] text-white"
              : "bg-[#F5F3F0] text-[#4A4A4A] hover:bg-[#E8E4E0]"
          }`}
          onClick={() => setAssigneeFilter("everyone")}
        >
          Everyone
        </button>
        {participants.map((p, i) => {
          const avatarUrl = participantAvatarUrls[i] ?? null;
          return (
            <button
              key={p.id}
              type="button"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                assigneeFilter === p.id
                  ? "bg-[#E07A5F] text-white"
                  : "bg-[#F5F3F0] text-[#4A4A4A] hover:bg-[#E8E4E0]"
              }`}
              onClick={() => setAssigneeFilter(p.id)}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  loading="lazy"
                  className="size-6 shrink-0 rounded-full object-cover"
                  aria-hidden
                />
              ) : (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E8E4E0] text-xs font-medium text-[#6B7280]"
                  aria-hidden
                >
                  {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {canEditContent && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
                onClick={() => setManageCategoriesOpen(true)}
              >
                Manage Categories
              </button>
              <button
                type="button"
                className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
                onClick={() => setManageListOpen(true)}
              >
                Manage packing lists
              </button>
            </div>
            <button
              type="button"
              className="rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F]"
              onClick={() => {
                setAddCategoryId(categories[0]?.id ?? "");
                setAddModalMode("add-item");
                setAddModalOpen(true);
              }}
            >
              + Add Item
            </button>
          </div>
        </>
      )}

      <div className="mt-6 space-y-5">
        {viewMode === "category" && canEditContent && onReorderGroup && onMoveItem ? (
          <GroupedSortableList<PackingItem>
            groups={itemsByCategory.map(({ category, items }) => ({ groupKey: category.id, items }))}
            groupingMeta={(() => {
              const meta = getPackingGroupingMode("category");
              return { field: meta.field, groupKeyToFieldValue: (k: string) => meta.groupKeyToFieldValue(k) };
            })()}
            onReorder={(_groupKey, newOrderedItems) => onReorderGroup(newOrderedItems)}
            onMove={(item, fromGroupKey, toGroupKey, insertIndex) => onMoveItem!("category", item, fromGroupKey, toGroupKey, insertIndex)}
            renderGroupHeader={(groupKey) => {
              const entry = itemsByCategory.find(({ category }) => category.id === groupKey);
              if (!entry) return null;
              return renderCategoryHeader(entry.category, entry.items);
            }}
            renderItem={(item, sortable) =>
              renderSortableRow(item, sortable, getAssigneeLabel(item, participants))
            }
            listTag="ul"
            listClassName={ITEM_LIST_CLASS}
            groupClassName={GROUP_CARD_CLASS}
            disabled={!canEditContent}
            renderGroupFooter={canEditContent ? (groupKey) => renderAddItemButton(groupKey) : undefined}
          />
        ) : viewMode === "category" &&
          itemsByCategory.map(({ category, items: catItems }) => (
            <div key={category.id} className={GROUP_CARD_CLASS}>
              {renderCategoryHeader(category, catItems)}
              {canEditContent && onReorderGroup ? (
                <SortableGroupList<PackingItem>
                  items={catItems}
                  onReorder={onReorderGroup}
                  as="ul"
                  className={ITEM_LIST_CLASS}
                  disabled={!canEditContent}
                >
                  {(item, sortable) =>
                    renderSortableRow(item, sortable, getAssigneeLabel(item, participants))
                  }
                </SortableGroupList>
              ) : (
                <ul className={ITEM_LIST_CLASS} role="list">
                  {catItems.map((item) => (
                    <li key={item.id} className="group list-none" dir={listRtl ? "rtl" : undefined}>
                      {renderItemRow(item, getAssigneeLabel(item, participants))}
                    </li>
                  ))}
                </ul>
              )}
              {canEditContent && renderAddItemButton(category.id)}
            </div>
          ))}

        {viewMode === "participant" && canEditContent && onReorderGroup && onMoveItem ? (
          <GroupedSortableList<PackingItem>
            groups={itemsByParticipant.map(({ participantId, items }) => ({
              groupKey: participantId ?? PACKING_GROUP_KEY_EVERYONE,
              items,
            }))}
            groupingMeta={(() => {
              const meta = getPackingGroupingMode("participant");
              return { field: meta.field, groupKeyToFieldValue: (k: string) => meta.groupKeyToFieldValue(k) };
            })()}
            onReorder={(_groupKey, newOrderedItems) => onReorderGroup(newOrderedItems)}
            onMove={(item, fromGroupKey, toGroupKey, insertIndex) => onMoveItem!("participant", item, fromGroupKey, toGroupKey, insertIndex)}
            renderGroupHeader={(groupKey) => {
              const part = itemsByParticipant.find(
                (p) => (p.participantId ?? PACKING_GROUP_KEY_EVERYONE) === groupKey
              );
              if (!part) return null;
              return renderParticipantHeader(
                part.label,
                getParticipantAvatarUrl(part.participantId),
                part.items
              );
            }}
            renderItem={(item, sortable) =>
              renderSortableRow(item, sortable, getCategoryName(item.category_id, categories))
            }
            listTag="ul"
            listClassName={ITEM_LIST_CLASS}
            groupClassName={GROUP_CARD_CLASS}
            disabled={!canEditContent}
            renderGroupFooter={canEditContent ? (groupKey) => renderAddItemButton(groupKey) : undefined}
          />
        ) : viewMode === "participant" &&
          itemsByParticipant.map(({ label, participantId, items: partItems }) => (
            <div key={participantId ?? "__everyone__"} className={GROUP_CARD_CLASS}>
              {renderParticipantHeader(label, getParticipantAvatarUrl(participantId), partItems)}
              {canEditContent && onReorderGroup ? (
                <SortableGroupList<PackingItem>
                  items={partItems}
                  onReorder={onReorderGroup}
                  as="ul"
                  className={ITEM_LIST_CLASS}
                  disabled={!canEditContent}
                >
                  {(item, sortable) =>
                    renderSortableRow(item, sortable, getCategoryName(item.category_id, categories))
                  }
                </SortableGroupList>
              ) : (
                <ul className={ITEM_LIST_CLASS} role="list">
                  {partItems.map((item) => (
                    <li key={item.id} className="group list-none" dir={listRtl ? "rtl" : undefined}>
                      {renderItemRow(item, getCategoryName(item.category_id, categories))}
                    </li>
                  ))}
                </ul>
              )}
              {canEditContent && renderAddItemButton(participantId ?? PACKING_GROUP_KEY_EVERYONE)}
            </div>
          ))}
      </div>

      {filteredItems.length === 0 && (
        <p className="mt-6 text-sm text-[#6B7280]">No packing items yet. Add your first one.</p>
      )}

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <div className="flex max-h-[85vh] min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <DialogHeader>
                <DialogTitle className="text-[#4A4A4A]">
                  {addModalMode === "create-category" ? "Create category" : "Add Item"}
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {addModalMode === "create-category" ? (
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="shrink-0">
                      <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Icon</label>
                      <CategoryIconPicker
                        value={createCategoryIcon}
                        onChange={setCreateCategoryIcon}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Category name</label>
                      <input
                        type="text"
                        value={createCategoryName}
                        onChange={(e) => setCreateCategoryName(e.target.value)}
                        placeholder="e.g. Toiletries"
                        className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
                        disabled={createCategorySaving}
                      />
                    </div>
                  </div>
                  {createCategoryError && (
                    <p className="text-sm text-red-600">{createCategoryError}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]"
                      onClick={() => {
                        setCreateCategoryName("");
                        setCreateCategoryIcon(PACKING_DEFAULT_ICON);
                        setCreateCategoryError(null);
                        setAddModalMode("add-item");
                      }}
                      disabled={createCategorySaving}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#D96A4F] disabled:opacity-50"
                      onClick={handleCreateCategory}
                      disabled={createCategorySaving}
                    >
                      {createCategorySaving ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Title (required)</label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="Item name"
                    dir="auto"
                    style={{ unicodeBidi: "plaintext" }}
                    className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
                    disabled={addSaving}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm"
                    disabled={addSaving}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Category</label>
                  <select
                    value={addCategoryId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__create_new__") {
                        setAddModalMode("create-category");
                      } else {
                        setAddCategoryId(v);
                      }
                    }}
                    className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A]"
                    disabled={addSaving}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__create_new__">+ Create new category</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Assigned to</label>
                  <select
                    value={addAssignedTo ?? "everyone"}
                    onChange={(e) => setAddAssignedTo(e.target.value === "everyone" ? null : e.target.value)}
                    className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A]"
                    disabled={addSaving}
                  >
                    <option value="everyone">Everyone</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {addError && <p className="text-sm text-red-600">{addError}</p>}
              </div>
            )}
            </div>
            {addModalMode === "add-item" && (
            <div className="shrink-0 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]"
                  onClick={() => setAddModalOpen(false)}
                  disabled={addSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#D96A4F] disabled:opacity-50"
                  onClick={handleAddItem}
                  disabled={addSaving}
                >
                  {addSaving ? "Adding…" : "Add Item"}
                </button>
              </div>
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
