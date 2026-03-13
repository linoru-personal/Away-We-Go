"use client";

import { useState, useMemo, useEffect } from "react";
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
import { SortableGroupList } from "@/components/ui/sortable-group-list";
import { GroupedSortableList } from "@/components/ui/grouped-sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";
import { getPackingGroupingMode, PACKING_GROUP_KEY_EVERYONE } from "@/lib/list-grouping";

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
  /** When provided, enables drag-and-drop reorder within each group. Called with items in new order; parent updates state and persists. */
  onReorderGroup?: (newOrderedItems: PackingItem[]) => Promise<void>;
  /** When provided with onReorderGroup, enables moving items across groups. viewMode is the current list view so parent can set the correct field. */
  onMoveItem?: (viewMode: "category" | "participant", item: PackingItem, fromGroupKey: string, toGroupKey: string, insertIndex: number) => Promise<void>;
}

const CARD_CLASS = "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-2.5">
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

function getAssigneeLabel(item: PackingItem, participants: PackingParticipant[]): string {
  if (!item.assigned_to_participant_id) return "Everyone";
  const p = participants.find((x) => x.id === item.assigned_to_participant_id);
  return p?.name ?? "Everyone";
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
  const [editTitle, setEditTitle] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [toggleErrorId, setToggleErrorId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

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
  /** When true, (filtered) items are shown RTL; majority wins, on tie keep current. */
  const listRtl = useMemo(() => {
    if (filteredItems.length === 0) return false;
    const rtlCount = filteredItems.filter((item) => isRtlText(item.title)).length;
    const total = filteredItems.length;
    const half = total / 2;
    if (rtlCount > half) return true;
    if (rtlCount < half) return false;
    return lastDirection === "rtl";
  }, [filteredItems, lastDirection]);
  useEffect(() => {
    if (filteredItems.length === 0) return;
    const rtlCount = filteredItems.filter((item) => isRtlText(item.title)).length;
    const total = filteredItems.length;
    const half = total / 2;
    if (rtlCount > half) setLastDirection("rtl");
    else if (rtlCount < half) setLastDirection("ltr");
  }, [filteredItems]);

  async function handleTogglePacked(item: PackingItem) {
    setToggleErrorId(null);
    const next = !item.is_packed;
    const prev = items.find((i) => i.id === item.id);
    if (!prev) return;

    const { error } = await supabase
      .from("packing_items")
      .update({ is_packed: next })
      .eq("id", item.id);

    if (error) {
      setToggleErrorId(item.id);
      return;
    }
    await onRefresh();
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
    const { error } = await supabase.from("packing_items").insert({
      trip_id: tripId,
      category_id: addCategoryId,
      title,
      quantity: addQuantity >= 1 ? addQuantity : 1,
      is_packed: false,
      assigned_to_participant_id: addAssignedTo,
    });
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
    if (meta.field === "category_id") setAddCategoryId(String(value ?? ""));
    else setAddAssignedTo(value as string | null);
    setAddPrefillGroupKey(null);
  }, [addModalOpen, addPrefillGroupKey, viewMode, canEditContent]);

  function openEdit(item: PackingItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditQuantity(item.quantity);
    setEditCategoryId(item.category_id);
    setEditAssignedTo(item.assigned_to_participant_id);
  }

  function openAddFromGroup(groupKey: string) {
    setAddPrefillGroupKey(groupKey);
    setAddModalMode("add-item");
    setAddModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const title = editTitle.trim();
    if (!title) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("packing_items")
      .update({
        title,
        quantity: editQuantity >= 1 ? editQuantity : 1,
        category_id: editCategoryId,
        assigned_to_participant_id: editAssignedTo,
      })
      .eq("id", editingId);
    setEditSaving(false);
    if (error) return;
    setEditingId(null);
    await onRefresh();
  }

  async function handleDelete(itemId: string) {
    setDeleteLoading(true);
    const { error } = await supabase.from("packing_items").delete().eq("id", itemId);
    setDeleteLoading(false);
    setDeleteConfirmId(null);
    if (error) return;
    await onRefresh();
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
          onClick={() => setManageCategoriesOpen(true)}
        >
          Manage Categories
        </button>
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
      )}

      <div className="mt-6 space-y-6">
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
              const cat = categories.find((c) => c.id === groupKey);
              if (!cat) return null;
              return (
                <div className="mb-3 flex items-center gap-2">
                  <span className="shrink-0 text-[#4A4A4A]">
                    <CategoryIcon iconKey={getIconKey(cat.icon, PACKING_DEFAULT_ICON)} size={20} />
                  </span>
                  <h3 className="text-base font-semibold text-[#4A4A4A]">{cat.name}</h3>
                </div>
              );
            }}
            renderItem={(item, { setNodeRef, style, attributes, listeners, isDragging }) => (
              <li
                ref={setNodeRef}
                style={style}
                className="group relative flex items-center gap-2 rounded-sm py-0.5 transition-shadow duration-150 hover:bg-[#F5F3F0]/60"
                dir={listRtl ? "rtl" : undefined}
              >
                <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm transition-all duration-150 ${isDragging ? "shadow-lg scale-[1.01]" : ""}`}>
                  <DragHandle listeners={listeners} attributes={attributes} />
                  <button
                    type="button"
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                      item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleTogglePacked(item); }}
                    disabled={!!toggleErrorId}
                  >
                    {item.is_packed && <CheckIcon />}
                  </button>
                  {editingId === item.id ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} dir="auto" style={{ unicodeBidi: "plaintext" }} className="min-w-[120px] rounded border border-[#D4C5BA] px-2 py-1 text-sm" />
                    <input type="number" min={1} value={editQuantity} onChange={(e) => setEditQuantity(parseInt(e.target.value, 10) || 1)} className="w-14 rounded border border-[#D4C5BA] px-2 py-1 text-sm" />
                    <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="rounded border border-[#D4C5BA] px-2 py-1 text-sm">
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={editAssignedTo ?? "everyone"} onChange={(e) => setEditAssignedTo(e.target.value === "everyone" ? null : e.target.value)} className="rounded border border-[#D4C5BA] px-2 py-1 text-sm">
                      <option value="everyone">Everyone</option>
                      {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button type="button" className="rounded bg-[#E07A5F] px-2 py-1 text-sm text-white disabled:opacity-50" onClick={handleSaveEdit} disabled={editSaving}>Save</button>
                    <button type="button" className="rounded border border-[#D4C5BA] px-2 py-1 text-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                      <p className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"} dir={listRtl ? "rtl" : "ltr"} style={{ unicodeBidi: "plaintext" }}>{item.title}</p>
                      <p className="text-xs text-[#9B7B6B]"><span dir="ltr">{getAssigneeLabel(item, participants)}</span>{item.quantity > 1 && <span dir="ltr" className="ms-1">× {item.quantity}</span>}</p>
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]" onClick={() => openEdit(item)} aria-label="Edit"><PencilIcon /></button>
                      {deleteConfirmId === item.id ? (
                        <><span className="text-xs text-[#6B7280]">Delete?</span><button type="button" className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(item.id)} disabled={deleteLoading}>Yes</button><button type="button" className="text-xs text-[#6B7280] hover:underline" onClick={() => setDeleteConfirmId(null)}>No</button></>
                      ) : (
                        <button type="button" className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]" onClick={() => setDeleteConfirmId(item.id)} aria-label="Delete"><TrashIcon /></button>
                      )}
                    </div>
                  </>
                )}
                </div>
              </li>
            )}
            listTag="ul"
            listClassName="space-y-3"
            groupClassName={CARD_CLASS}
            disabled={!canEditContent}
            renderGroupFooter={
              canEditContent
                ? (groupKey) => (
                    <button
                      type="button"
                      className="mt-2 text-sm text-[#6B7280] hover:text-[#E07A5F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1 rounded transition-colors duration-150"
                      onClick={() => openAddFromGroup(groupKey)}
                    >
                      + Add item
                    </button>
                  )
                : undefined
            }
          />
        ) : viewMode === "category" &&
          itemsByCategory.map(({ category, items: catItems }) => (
            <div key={category.id} className={CARD_CLASS}>
              <div className="mb-3 flex items-center gap-2">
                <span className="shrink-0 text-[#4A4A4A]">
                  <CategoryIcon iconKey={getIconKey(category.icon, PACKING_DEFAULT_ICON)} size={20} />
                </span>
                <h3 className="text-base font-semibold text-[#4A4A4A]">{category.name}</h3>
              </div>
              {canEditContent && onReorderGroup ? (
                <SortableGroupList<PackingItem>
                  items={catItems}
                  onReorder={onReorderGroup}
                  as="ul"
                  className="space-y-3"
                  disabled={!canEditContent}
                >
                  {(item, { setNodeRef, style, attributes, listeners, isDragging }) => (
                    <li
                      ref={setNodeRef}
                      style={style}
                      className={`group relative flex items-center gap-2 rounded-sm py-0.5 transition-shadow duration-150 ${canEditContent ? "hover:bg-[#F5F3F0]/60" : ""}`}
                      dir={listRtl ? "rtl" : undefined}
                    >
                      <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm transition-all duration-150 ${isDragging ? "shadow-lg scale-[1.01]" : ""}`}>
                        {canEditContent && <DragHandle listeners={listeners} attributes={attributes} />}
                        {canEditContent ? (
                          <button
                            type="button"
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                              item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleTogglePacked(item); }}
                            disabled={!!toggleErrorId}
                          >
                            {item.is_packed && <CheckIcon />}
                          </button>
                        ) : (
                          <span
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 ${
                              item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                            }`}
                            aria-hidden
                          >
                            {item.is_packed && <CheckIcon />}
                          </span>
                        )}
                        {editingId === item.id && canEditContent ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            dir="auto"
                            style={{ unicodeBidi: "plaintext" }}
                            className="min-w-[120px] rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(parseInt(e.target.value, 10) || 1)}
                            className="w-14 rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          />
                          <select
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editAssignedTo ?? "everyone"}
                            onChange={(e) => setEditAssignedTo(e.target.value === "everyone" ? null : e.target.value)}
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          >
                            <option value="everyone">Everyone</option>
                            {participants.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="rounded bg-[#E07A5F] px-2 py-1 text-sm text-white disabled:opacity-50"
                            onClick={handleSaveEdit}
                            disabled={editSaving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                            <p
                              className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"}
                              dir={listRtl ? "rtl" : "ltr"}
                              style={{ unicodeBidi: "plaintext" }}
                            >
                              {item.title}
                            </p>
                            <p className="text-xs text-[#9B7B6B]">
                              <span dir="ltr">
                                {getAssigneeLabel(item, participants)}
                              </span>
                              {item.quantity > 1 && (
                                <span dir="ltr" className="ms-1">× {item.quantity}</span>
                              )}
                            </p>
                          </div>
                          {canEditContent && (
                          <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                              onClick={() => openEdit(item)}
                              aria-label="Edit"
                            >
                              <PencilIcon />
                            </button>
                            {deleteConfirmId === item.id ? (
                              <>
                                <span className="text-xs text-[#6B7280]">Delete?</span>
                                <button
                                  type="button"
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deleteLoading}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-[#6B7280] hover:underline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                                onClick={() => setDeleteConfirmId(item.id)}
                                aria-label="Delete"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                          )}
                        </>
                      )}
                      </div>
                    </li>
                  )}
                </SortableGroupList>
              ) : (
                <ul className="space-y-3" role="list">
                  {catItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3"
                      dir={listRtl ? "rtl" : undefined}
                    >
                      {canEditContent ? (
                        <button
                          type="button"
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                            item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                          }`}
                          onClick={() => handleTogglePacked(item)}
                          disabled={!!toggleErrorId}
                        >
                          {item.is_packed && <CheckIcon />}
                        </button>
                      ) : (
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 ${
                            item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                          }`}
                          aria-hidden
                        >
                          {item.is_packed && <CheckIcon />}
                        </span>
                      )}
                      {editingId === item.id && canEditContent ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            dir="auto"
                            style={{ unicodeBidi: "plaintext" }}
                            className="min-w-[120px] rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(parseInt(e.target.value, 10) || 1)}
                            className="w-14 rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          />
                          <select
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editAssignedTo ?? "everyone"}
                            onChange={(e) => setEditAssignedTo(e.target.value === "everyone" ? null : e.target.value)}
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                          >
                            <option value="everyone">Everyone</option>
                            {participants.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="rounded bg-[#E07A5F] px-2 py-1 text-sm text-white disabled:opacity-50"
                            onClick={handleSaveEdit}
                            disabled={editSaving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[#D4C5BA] px-2 py-1 text-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                            <p
                              className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"}
                              dir={listRtl ? "rtl" : "ltr"}
                              style={{ unicodeBidi: "plaintext" }}
                            >
                              {item.title}
                            </p>
                            <p className="text-xs text-[#9B7B6B]">
                              <span dir="ltr">
                                {getAssigneeLabel(item, participants)}
                              </span>
                              {item.quantity > 1 && (
                                <span dir="ltr" className="ms-1">× {item.quantity}</span>
                              )}
                            </p>
                          </div>
                          {canEditContent && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                              onClick={() => openEdit(item)}
                              aria-label="Edit"
                            >
                              <PencilIcon />
                            </button>
                            {deleteConfirmId === item.id ? (
                              <>
                                <span className="text-xs text-[#6B7280]">Delete?</span>
                                <button
                                  type="button"
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deleteLoading}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-[#6B7280] hover:underline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                                onClick={() => setDeleteConfirmId(item.id)}
                                aria-label="Delete"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEditContent && (
                <button
                  type="button"
                  className="mt-2 text-sm text-[#6B7280] hover:text-[#E07A5F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1 rounded transition-colors duration-150"
                  onClick={() => openAddFromGroup(category.id)}
                >
                  + Add item
                </button>
              )}
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
              const part = itemsByParticipant.find((p) => (p.participantId ?? PACKING_GROUP_KEY_EVERYONE) === groupKey);
              if (!part) return null;
              const avatarUrl =
                part.participantId === null
                  ? tripCoverImageUrl ?? null
                  : (() => {
                      const idx = participants.findIndex((p) => p.id === part.participantId);
                      return idx >= 0 ? participantAvatarUrls[idx] ?? null : null;
                    })();
              return (
                <div className="mb-3 flex items-center gap-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" aria-hidden />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E8E4E0] text-sm font-medium text-[#6B7280]" aria-hidden>
                      {part.label.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-[#4A4A4A]">{part.label}</h3>
                </div>
              );
            }}
            renderItem={(item, { setNodeRef, style, attributes, listeners, isDragging }) => (
              <li
                ref={setNodeRef}
                style={style}
                className="group relative flex items-center gap-2 rounded-sm py-0.5 transition-shadow duration-150 hover:bg-[#F5F3F0]/60"
                dir={listRtl ? "rtl" : undefined}
              >
                <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm transition-all duration-150 ${isDragging ? "shadow-lg scale-[1.01]" : ""}`}>
                  <DragHandle listeners={listeners} attributes={attributes} />
                  <button
                    type="button"
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                      item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleTogglePacked(item); }}
                    disabled={!!toggleErrorId}
                  >
                    {item.is_packed && <CheckIcon />}
                  </button>
                  <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                    <p className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"} dir={listRtl ? "rtl" : "ltr"} style={{ unicodeBidi: "plaintext" }}>{item.title}</p>
                    <p className="text-xs text-[#9B7B6B]"><span dir="ltr">{getCategoryName(item.category_id, categories)}</span>{item.quantity > 1 && <span dir="ltr" className="ms-1">× {item.quantity}</span>}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]" onClick={() => openEdit(item)} aria-label="Edit"><PencilIcon /></button>
                    {deleteConfirmId === item.id ? (
                      <button type="button" className="text-xs text-red-600" onClick={() => handleDelete(item.id)} disabled={deleteLoading}>Yes</button>
                    ) : (
                      <button type="button" className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]" onClick={() => setDeleteConfirmId(item.id)} aria-label="Delete"><TrashIcon /></button>
                    )}
                  </div>
                </div>
              </li>
            )}
            listTag="ul"
            listClassName="space-y-3"
            groupClassName={CARD_CLASS}
            disabled={!canEditContent}
            renderGroupFooter={
              canEditContent
                ? (groupKey) => (
                    <button
                      type="button"
                      className="mt-2 text-sm text-[#6B7280] hover:text-[#E07A5F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1 rounded transition-colors duration-150"
                      onClick={() => openAddFromGroup(groupKey)}
                    >
                      + Add item
                    </button>
                  )
                : undefined
            }
          />
        ) : viewMode === "participant" &&
          itemsByParticipant.map(({ label, participantId, items: partItems }) => {
            const avatarUrl =
              participantId === null
                ? tripCoverImageUrl ?? null
                : (() => {
                    const idx = participants.findIndex((p) => p.id === participantId);
                    return idx >= 0 ? participantAvatarUrls[idx] ?? null : null;
                  })();
            return (
            <div key={participantId ?? "__everyone__"} className={CARD_CLASS}>
              <div className="mb-3 flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
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
                <h3 className="text-base font-semibold text-[#4A4A4A]">{label}</h3>
              </div>
              {canEditContent && onReorderGroup ? (
                <SortableGroupList<PackingItem>
                  items={partItems}
                  onReorder={onReorderGroup}
                  as="ul"
                  className="space-y-3"
                  disabled={!canEditContent}
                >
                  {(item, { setNodeRef, style, attributes, listeners, isDragging }) => (
                    <li
                      ref={setNodeRef}
                      style={style}
                      className={`group relative flex items-center gap-2 rounded-sm py-0.5 transition-shadow duration-150 ${canEditContent ? "hover:bg-[#F5F3F0]/60" : ""}`}
                      dir={listRtl ? "rtl" : undefined}
                    >
                      <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm transition-all duration-150 ${isDragging ? "shadow-lg scale-[1.01]" : ""}`}>
                        {canEditContent && <DragHandle listeners={listeners} attributes={attributes} />}
                        {canEditContent ? (
                          <button
                            type="button"
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                              item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleTogglePacked(item); }}
                            disabled={!!toggleErrorId}
                          >
                            {item.is_packed && <CheckIcon />}
                          </button>
                        ) : (
                          <span
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 ${
                              item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                            }`}
                            aria-hidden
                          >
                            {item.is_packed && <CheckIcon />}
                          </span>
                        )}
                        <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                          <p
                            className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"}
                            dir={listRtl ? "rtl" : "ltr"}
                            style={{ unicodeBidi: "plaintext" }}
                          >
                            {item.title}
                          </p>
                          <p className="text-xs text-[#9B7B6B]">
                            <span dir="ltr">
                              {getCategoryName(item.category_id, categories)}
                            </span>
                            {item.quantity > 1 && (
                              <span dir="ltr" className="ms-1">× {item.quantity}</span>
                            )}
                          </p>
                        </div>
                        {canEditContent && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                            onClick={() => openEdit(item)}
                            aria-label="Edit"
                          >
                            <PencilIcon />
                          </button>
                          {deleteConfirmId === item.id ? (
                            <button
                              type="button"
                              className="text-xs text-red-600"
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteLoading}
                            >
                              Yes
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                              onClick={() => setDeleteConfirmId(item.id)}
                              aria-label="Delete"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    </li>
                  )}
                </SortableGroupList>
              ) : (
                <ul className="space-y-3" role="list">
                  {partItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3"
                      dir={listRtl ? "rtl" : undefined}
                    >
                      {canEditContent ? (
                        <button
                          type="button"
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                            item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                          }`}
                          onClick={() => handleTogglePacked(item)}
                          disabled={!!toggleErrorId}
                        >
                          {item.is_packed && <CheckIcon />}
                        </button>
                      ) : (
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 ${
                            item.is_packed ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#D4C5BA] bg-white"
                          }`}
                          aria-hidden
                        >
                          {item.is_packed && <CheckIcon />}
                        </span>
                      )}
                      <div className={`min-w-0 flex-1 ${listRtl ? "text-right" : ""}`}>
                        <p
                          className={item.is_packed ? "text-sm text-[#9B7B6B] line-through" : "text-sm text-[#6B7280]"}
                          dir={listRtl ? "rtl" : "ltr"}
                          style={{ unicodeBidi: "plaintext" }}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-[#9B7B6B]">
                          <span dir="ltr">
                            {getCategoryName(item.category_id, categories)}
                          </span>
                          {item.quantity > 1 && (
                            <span dir="ltr" className="ms-1">× {item.quantity}</span>
                          )}
                        </p>
                      </div>
                      {canEditContent && (
                      <>
                        <button
                          type="button"
                          className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                          onClick={() => openEdit(item)}
                          aria-label="Edit"
                        >
                          <PencilIcon />
                        </button>
                        {deleteConfirmId === item.id ? (
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteLoading}
                          >
                            Yes
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded p-1 text-[#6B7280] hover:bg-[#F5F3F0]"
                            onClick={() => setDeleteConfirmId(item.id)}
                            aria-label="Delete"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEditContent && (
                <button
                  type="button"
                  className="mt-2 text-sm text-[#6B7280] hover:text-[#E07A5F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/30 focus-visible:ring-offset-1 rounded transition-colors duration-150"
                  onClick={() => openAddFromGroup(participantId ?? PACKING_GROUP_KEY_EVERYONE)}
                >
                  + Add item
                </button>
              )}
            </div>
            );
          })}
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
