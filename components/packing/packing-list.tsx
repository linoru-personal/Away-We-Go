"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
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
import { AddFromUsualStuffDialog } from "@/components/usual-stuff/add-from-usual-stuff-dialog";
import {
  SortableGroupList,
  type SortableGroupListSortableProps,
} from "@/components/ui/sortable-group-list";
import { GroupedSortableList } from "@/components/ui/grouped-sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";
import { PackingItemRow } from "@/components/packing/packing-item-row";
import { HandDrawnIcon } from "@/components/ui/hand-drawn-icons";
import { PackingProgressCard } from "@/components/packing/packing-progress-card";
import { PackingListMenu } from "@/components/packing/packing-list-menu";
import { PackingToolbar } from "@/components/packing/packing-toolbar";
import {
  PackingPeopleProgress,
  type PackingPersonProgress,
} from "@/components/packing/packing-people-progress";
import {
  PACKING_ICON_BUTTON_CLASS,
  PACKING_ICON_TILE_CLASS,
  PACKING_SECONDARY_BUTTON_CLASS,
} from "@/components/packing/packing-styles";
import {
  PACKING_GROUP_CARD_CLASS,
  PackingAllPacked,
  PackingGroupCard,
  PackingGroupCardHeader,
  type PackingGroupCardHeaderProps,
} from "@/components/packing/packing-group-card";
import {
  PackingItemEditorDialog,
  type PackingItemEditorValues,
} from "@/components/packing/packing-item-editor-dialog";
import { getPackingGroupingMode, PACKING_GROUP_KEY_EVERYONE } from "@/lib/list-grouping";
import {
  readCollapsedGroups,
  writeCollapsedGroups,
} from "@/lib/packing/collapsed-groups";
import {
  deletePackingItem,
  updatePackingItem,
  type PackingItemPatch,
} from "@/lib/packing/packing-item-mutations";
import { addToMyUsualStuff, updateUsualItem } from "@/lib/usual-stuff/queries";
import type { UsualRowInput } from "@/lib/usual-stuff/types";
import { buildPackingShareText, sharePackingText } from "@/lib/packing/share-text";
import {
  hasMultipleAssignees,
  splitByPerson,
  type PersonBlock,
} from "@/lib/packing/person-groups";
import { visibleItems } from "@/lib/packing/visible-items";

const PACKING_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 disabled:opacity-50";

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
  /** Used in the title of the shared text. */
  tripTitle: string;
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
 * Rows draw their own top hairline, and the group header has none, so there is
 * exactly one line between the header and the first row, and a collapsed
 * group (rows hidden) leaves no stray line under its header.
 */
const ITEM_LIST_CLASS = "";

/** Group cards: one column on the phone, a grid of at least 320px columns on wider screens. */
const GROUP_GRID_CLASS =
  "grid grid-cols-1 items-start gap-4 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-5";

/**
 * Press-and-hold before a touch drag starts. The whole row is the touch handle, so this is longer
 * than the 200 ms default: a slow start of a scroll must not pick an item up.
 */
const TOUCH_DRAG_DELAY_MS = 450;

/** How long a just-ticked item stays on screen while packed items are hidden. */
const LINGER_MS = 4000;

/** Sub-header inside a card: a person inside a category, or a category inside a person. */
const SUB_HEADER_CLASS =
  "list-none px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-[#8A4A35]";

function getCategoryName(categoryId: string, categories: PackingCategory[]): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

function getCategoryIcon(categoryId: string, categories: PackingCategory[]): string | null {
  return categories.find((c) => c.id === categoryId)?.icon ?? null;
}

export function PackingList({
  tripId,
  tripTitle,
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
  const [viewMode, setViewModeState] = useState<"category" | "participant">("category");
  // Remembered per browser (one key for all trips). Read after mount so server and client HTML match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("packing-view-mode");
      if (saved === "category" || saved === "participant") setViewModeState(saved);
    } catch {
      // localStorage unavailable: stay on the default view.
    }
  }, []);
  function setViewMode(mode: "category" | "participant") {
    setViewModeState(mode);
    try {
      window.localStorage.setItem("packing-view-mode", mode);
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  }
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  /** Desktop "Find an item" filter. */
  const [searchQuery, setSearchQuery] = useState("");
  const [showPacked, setShowPackedState] = useState(false);
  // Remembered per browser, read after mount so server and client HTML match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("packing-show-packed");
      if (saved === "true" || saved === "false") setShowPackedState(saved === "true");
    } catch {
      // localStorage unavailable: stay on the default.
    }
  }, []);
  function setShowPacked(next: boolean) {
    setShowPackedState(next);
    showPackedRef.current = next;
    // Packed items are all on screen now, so nothing needs to linger.
    if (next) clearAllLingering();
    try {
      window.localStorage.setItem("packing-show-packed", String(next));
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  }
  /** Read by handleTogglePacked after its await, when the render-time value may be stale. */
  const showPackedRef = useRef(showPacked);
  useEffect(() => {
    showPackedRef.current = showPacked;
  }, [showPacked]);
  /**
   * Items just ticked while packed items are hidden, with when their linger started (Date.now()).
   * They stay on screen (crossed out, then fading) for LINGER_MS before they disappear; the start
   * time lets a row that remounts resume its fade at the right point. One timer per item.
   */
  const [lingering, setLingering] = useState<Map<string, number>>(() => new Map());
  const lingerTimersRef = useRef<Map<string, number>>(new Map());
  function stopLingering(itemId: string) {
    const timer = lingerTimersRef.current.get(itemId);
    if (timer !== undefined) window.clearTimeout(timer);
    lingerTimersRef.current.delete(itemId);
    setLingering((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }
  function startLingering(itemId: string) {
    const existing = lingerTimersRef.current.get(itemId);
    if (existing !== undefined) window.clearTimeout(existing);
    lingerTimersRef.current.set(
      itemId,
      window.setTimeout(() => stopLingering(itemId), LINGER_MS)
    );
    // A new start time also restarts the fade of a row that was already lingering.
    const startedAt = Date.now();
    setLingering((prev) => new Map(prev).set(itemId, startedAt));
  }
  function clearAllLingering() {
    for (const timer of lingerTimersRef.current.values()) window.clearTimeout(timer);
    lingerTimersRef.current.clear();
    setLingering((prev) => (prev.size === 0 ? prev : new Map()));
  }
  useEffect(() => {
    const timers = lingerTimersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);
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
  /** The item open in the editor dialog, and whether it opened on the delete confirmation. */
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [editorConfirmDelete, setEditorConfirmDelete] = useState(false);
  const editBaselineRef = useRef<{
    title: string;
    quantity: number;
    category_id: string;
    assigned_to_participant_id: string | null;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  /** Last failed toggle/edit/delete, shown on that item's row only. */
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageListOpen, setManageListOpen] = useState(false);
  const [manageListStartAtDelete, setManageListStartAtDelete] = useState(false);
  const [fromUsualOpen, setFromUsualOpen] = useState(false);
  /** True while an "add to my usual stuff" call is in flight (guards double clicks). */
  const [usualBusy, setUsualBusy] = useState(false);
  /** Inline prompt in the item editor: the item is already in usual stuff. usualItemId is null when the server gave none. */
  const [usualPrompt, setUsualPrompt] = useState<{
    itemId: string;
    usualItemId: string | null;
    quantity: number;
  } | null>(null);
  const [usualError, setUsualError] = useState<{ key: string; message: string } | null>(null);
  const [listManagementMessage, setListManagementMessage] = useState<string | null>(
    null
  );
  // The banner is a toast: it clears itself 3 seconds after it appears.
  useEffect(() => {
    if (!listManagementMessage) return;
    const timer = setTimeout(() => setListManagementMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [listManagementMessage]);
  /**
   * Group keys the viewer has folded shut. Seeded straight from localStorage:
   * safe as a lazy initializer because the list renders its loading branch on
   * the server and on first client render, so nothing can mismatch.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    readCollapsedGroups(tripId)
  );

  function toggleGroupCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (!next.delete(groupKey)) next.add(groupKey);
      writeCollapsedGroups(tripId, next);
      return next;
    });
  }

  const packedCount = items.filter((i) => i.is_packed).length;
  const totalCount = items.length;

  const filteredItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return items.filter((i) => {
      const aid = i.assigned_to_participant_id;
      if (assigneeFilter === "everyone" && aid) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "everyone" && aid !== assigneeFilter) return false;
      return !needle || i.title.toLowerCase().includes(needle);
    });
  }, [items, assigneeFilter, searchQuery]);

  /** Person sub-headers show in every category when the trip (all items, not the filtered ones) has two or more assignees. */
  const showPersonGroups = useMemo(() => hasMultipleAssignees(items), [items]);

  /**
   * One entry per category that has items after the assignee and search filters.
   * `items` are the rows on screen (packed ones dropped unless shown or lingering): the
   * drag-and-drop and the person sub-headers work on these, so indices match the screen.
   * `packed`/`total` count every filtered item of the category, shown or not.
   */
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category_id) ?? [];
      list.push(item);
      map.set(item.category_id, list);
    }
    const catOrder = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return catOrder
      .filter((c) => map.has(c.id))
      .map((c) => {
        const allItems = map.get(c.id)!;
        const counts = { packed: allItems.filter((i) => i.is_packed).length, total: allItems.length };
        const catItems = visibleItems(allItems, showPacked, lingering, itemError?.id ?? null);
        if (!showPersonGroups) return { category: c, items: catItems, blocks: [] as PersonBlock[], ...counts };
        // Displayed order: person by person (Everyone first); the order inside a person is the saved order.
        const blocks = splitByPerson(catItems, participants);
        return { category: c, items: blocks.flatMap((b) => b.items), blocks, ...counts };
      });
  }, [filteredItems, categories, participants, showPersonGroups, showPacked, lingering, itemError]);

  /** The item that opens each person block in By category view (that is where the person sub-header goes). */
  const personBlockStarts = useMemo(() => {
    const m = new Map<string, PersonBlock>();
    for (const entry of itemsByCategory) {
      for (const block of entry.blocks) m.set(block.items[0].id, block);
    }
    return m;
  }, [itemsByCategory]);

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
    const catOrder = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    /** Splits one person's items by category, in category order. Item order inside a category is kept (already sort_order, created_at, id). */
    const byCategory = (list: PackingItem[]) => {
      const map = new Map<string, PackingItem[]>();
      for (const item of list) {
        const inCat = map.get(item.category_id) ?? [];
        inCat.push(item);
        map.set(item.category_id, inCat);
      }
      const groups = catOrder
        .filter((c) => map.has(c.id))
        .map((c) => ({ category: c, items: [...map.get(c.id)!].sort((a, b) => a.sort_order - b.sort_order) }));
      return { categories: groups, items: groups.flatMap((g) => g.items) };
    };
    /** A person's group: counts over all their filtered items, rows (and sub-headers) over the visible ones. */
    const group = (list: PackingItem[]) => ({
      packed: list.filter((i) => i.is_packed).length,
      total: list.length,
      ...byCategory(visibleItems(list, showPacked, lingering, itemError?.id ?? null)),
    });
    const result: {
      label: string;
      participantId: string | null;
      categories: { category: PackingCategory; items: PackingItem[] }[];
      /** The person's visible items, category by category: the flat list the drag-and-drop works on. */
      items: PackingItem[];
      packed: number;
      total: number;
    }[] = [{ label: "Everyone", participantId: null, ...group(everyone) }];
    for (const p of participants) {
      const list = byParticipant.get(p.id) ?? [];
      if (list.length > 0) result.push({ label: p.name, participantId: p.id, ...group(list) });
    }
    return result;
  }, [filteredItems, participants, categories, showPacked, lingering, itemError]);

  /** For each person group, the item that opens each category block (that is where the sub-header goes). */
  const personCategoryStarts = useMemo(() => {
    const m = new Map<string, PackingCategory>();
    for (const g of itemsByParticipant) {
      for (const { category, items: catItems } of g.categories) m.set(catItems[0].id, category);
    }
    return m;
  }, [itemsByParticipant]);

  const editorItem = editorItemId ? items.find((i) => i.id === editorItemId) ?? null : null;

  async function handleTogglePacked(item: PackingItem) {
    // Clear other rows' errors now; this row's error (which keeps a packed row on screen) is
    // cleared only once the retry succeeds, so the row doesn't vanish while it is in flight.
    setItemError((prev) => (prev && prev.id !== item.id ? null : prev));
    const next = !item.is_packed;

    const { error } = await updatePackingItem(
      supabase,
      item.id,
      { is_packed: next },
      "toggle-packed"
    );

    if (error) {
      setItemError({ id: item.id, message: "Couldn't update this item. Tap to try again." });
      // The row stays on screen with its error until the user acts: visibleItems keeps the
      // item with the error, and it stops lingering so it no longer fades out.
      stopLingering(item.id);
      return;
    }
    // Order matters if React ever renders these updates apart: a packed item must already be
    // lingering when it turns packed, and an un-packed one must be unpacked before it stops
    // lingering, or its row would unmount for a frame and lose its fade.
    if (next && !showPackedRef.current) {
      // Packed items are hidden: keep this one on screen, crossed out, for a moment before it goes.
      startLingering(item.id);
    }
    setItemError((prev) => (prev?.id === item.id ? null : prev));
    onItemsPatched?.(item.id, { is_packed: next });
    if (!next) stopLingering(item.id);
  }

  async function handleShare() {
    const { text, summary } = buildPackingShareText({
      tripTitle,
      scope: { viewMode, assigneeFilter },
      categories,
      participants,
      items,
    });
    try {
      const result = await sharePackingText(text);
      if (result === "cancelled") return;
      setListManagementMessage(result === "shared" ? summary.replace(/^Copied/, "Shared") : summary);
    } catch {
      setListManagementMessage("Couldn't copy the list");
    }
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
    // New items go to the bottom of their category.
    const inCategory = items.filter((i) => i.category_id === addCategoryId);
    const sortOrder =
      inCategory.length > 0 ? Math.max(...inCategory.map((i) => i.sort_order)) + 1 : 0;
    const insertRow = {
      trip_id: tripId,
      category_id: addCategoryId,
      title,
      quantity: addQuantity >= 1 ? addQuantity : 1,
      is_packed: false,
      assigned_to_participant_id: addAssignedTo ?? null,
      sort_order: sortOrder,
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
        typeof prev === "string" && categories.some((c) => c.id === prev) ? prev : categories[0]?.id ?? ""
      );
    }
    setAddPrefillGroupKey(null);
  }, [addModalOpen, addPrefillGroupKey, viewMode, canEditContent, categories]);

  function usualRowFor(item: PackingItem): UsualRowInput {
    const person = item.assigned_to_participant_id
      ? participants.find((x) => x.id === item.assigned_to_participant_id)?.name ?? null
      : null;
    return {
      title: item.title,
      quantity: item.quantity,
      category_name: getCategoryName(item.category_id, categories),
      category_icon: getCategoryIcon(item.category_id, categories),
      person_label: person,
    };
  }

  async function handleAddItemToUsual(item: PackingItem) {
    if (usualBusy) return;
    setUsualBusy(true);
    setUsualPrompt(null);
    setUsualError(null);
    try {
      const result = await addToMyUsualStuff(supabase, [usualRowFor(item)]);
      if (result.added === 1) {
        setListManagementMessage("Added to your usual stuff");
      } else {
        // We sent one row, so skipped[0] (index 0, 0-based) is the only entry.
        setUsualPrompt({
          itemId: item.id,
          usualItemId: result.skipped[0]?.usual_item_id ?? null,
          quantity: item.quantity,
        });
      }
    } catch (e) {
      setUsualError({
        key: item.id,
        message: e instanceof Error ? e.message : "Couldn't add to your usual stuff",
      });
    } finally {
      setUsualBusy(false);
    }
  }

  async function handleUpdateUsualQuantity() {
    if (usualBusy || !usualPrompt?.usualItemId) return;
    const { itemId, usualItemId, quantity } = usualPrompt;
    setUsualBusy(true);
    setUsualError(null);
    try {
      await updateUsualItem(supabase, usualItemId, { quantity });
      setUsualPrompt(null);
      setListManagementMessage("Updated quantity in your usual stuff");
    } catch (e) {
      setUsualError({
        key: itemId,
        message: e instanceof Error ? e.message : "Couldn't update your usual stuff",
      });
    } finally {
      setUsualBusy(false);
    }
  }

  async function handleAddCategoryToUsual(category: PackingCategory) {
    if (usualBusy) return;
    setUsualError(null);
    // The whole category in display order, whatever the assignee chip shows.
    const catItems = items
      .filter((i) => i.category_id === category.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (catItems.length === 0) {
      setListManagementMessage("This category has no items yet");
      return;
    }
    setUsualBusy(true);
    try {
      const result = await addToMyUsualStuff(supabase, catItems.map(usualRowFor));
      const skipped = result.skipped.length;
      setListManagementMessage(
        result.added === 0
          ? `Nothing new: all ${catItems.length} were already there`
          : `Added ${result.added} ${result.added === 1 ? "item" : "items"}${
              skipped > 0 ? `, ${skipped} ${skipped === 1 ? "was" : "were"} already there` : ""
            }`
      );
    } catch (e) {
      setUsualError({
        key: category.id,
        message: e instanceof Error ? e.message : "Couldn't add to your usual stuff",
      });
    } finally {
      setUsualBusy(false);
    }
  }

  function closeEditor() {
    setItemError(null);
    setUsualPrompt(null);
    setUsualError(null);
    setEditorItemId(null);
    setEditorConfirmDelete(false);
    editBaselineRef.current = null;
  }

  function openEditor(item: PackingItem, confirmDelete = false) {
    setItemError(null);
    setUsualPrompt(null);
    setUsualError(null);
    setEditorItemId(item.id);
    setEditorConfirmDelete(confirmDelete);
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
    setAddCategoryId((prev) =>
      typeof prev === "string" && categories.some((c) => c.id === prev) ? prev : categories[0]?.id ?? ""
    );
    setAddModalOpen(true);
  }

  async function handleSaveEdit(values: PackingItemEditorValues) {
    const editingId = editorItemId;
    if (!editingId) return;
    const baseline = editBaselineRef.current;
    if (!baseline) return;

    const title = values.title.trim();
    if (!title) return;

    const quantity = values.quantity >= 1 ? values.quantity : 1;
    const patch: PackingItemPatch = {};

    if (title !== baseline.title) patch.title = title;
    if (quantity !== baseline.quantity) patch.quantity = quantity;
    if (values.categoryId !== baseline.category_id) patch.category_id = values.categoryId;

    const nextAssigned = values.assignedTo ?? null;
    if (nextAssigned !== baseline.assigned_to_participant_id) {
      patch.assigned_to_participant_id = nextAssigned;
    }

    if (Object.keys(patch).length === 0) {
      closeEditor();
      return;
    }

    setItemError(null);
    setEditSaving(true);
    const { error } = await updatePackingItem(
      supabase,
      editingId,
      patch,
      "save-edit"
    );
    setEditSaving(false);
    if (error) {
      // Editor stays open with the user's values so they can retry.
      setItemError({ id: editingId, message: "Couldn't save your changes. Please try again." });
      return;
    }

    onItemsPatched?.(editingId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.category_id !== undefined ? { category_id: patch.category_id } : {}),
      ...(patch.assigned_to_participant_id !== undefined
        ? { assigned_to_participant_id: patch.assigned_to_participant_id }
        : {}),
    });

    closeEditor();
  }

  async function handleDelete(itemId: string) {
    setItemError(null);
    setDeletingId(itemId);
    const { error } = await deletePackingItem(supabase, itemId);
    setDeletingId(null);
    if (error) {
      // Item stays and the confirmation stays open, so "Delete" retries.
      setItemError({ id: itemId, message: "Couldn't delete this item. Please try again." });
      return;
    }
    if (editorItemId === itemId) closeEditor();
    await onRefresh();
  }

  /** Avatar for a participant group; the trip cover stands in for "Everyone". */
  function getParticipantAvatarUrl(participantId: string | null): string | null {
    if (participantId === null) return tripCoverImageUrl ?? null;
    const idx = participants.findIndex((p) => p.id === participantId);
    return idx >= 0 ? participantAvatarUrls[idx] ?? null : null;
  }

  /** Header props for a category card. The counts cover every filtered item, shown or not. */
  function categoryHeaderProps(
    category: PackingCategory,
    counts: { packed: number; total: number }
  ): PackingGroupCardHeaderProps {
    return {
      leading: (
        <span className={`${PACKING_ICON_TILE_CLASS} text-[#3B312B]`} aria-hidden>
          <CategoryIcon iconKey={getIconKey(category.icon, PACKING_DEFAULT_ICON)} size={26} />
        </span>
      ),
      label: category.name,
      packed: counts.packed,
      total: counts.total,
      collapsed: collapsedGroups.has(category.id),
      onToggleCollapsed: () => toggleGroupCollapsed(category.id),
      onAdd: canEditContent ? () => openAddFromGroup(category.id) : undefined,
      extraAction: canEditContent ? (
        <button
          type="button"
          className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[#6B5B50] transition-colors hover:bg-[#FDEDE6] md:size-10 md:rounded-xl ${PACKING_FOCUS}`}
          aria-label="Add category to my usual stuff"
          title="Add category to my usual stuff"
          disabled={usualBusy}
          onClick={() => handleAddCategoryToUsual(category)}
        >
          <HandDrawnIcon name="usual_stuff" size={20} />
        </button>
      ) : undefined,
      notice:
        canEditContent && usualError?.key === category.id ? (
          <p className="px-4 pb-2 text-xs text-[#B42318]" role="alert">
            {usualError.message}
          </p>
        ) : undefined,
    };
  }

  /** Header props for a person card (By person view): photo or initial instead of the icon tile. */
  function participantHeaderProps(
    groupKey: string,
    label: string,
    participantId: string | null,
    counts: { packed: number; total: number }
  ): PackingGroupCardHeaderProps {
    const avatarUrl = getParticipantAvatarUrl(participantId);
    return {
      leading: avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          className="size-[42px] shrink-0 rounded-full object-cover md:size-11"
          aria-hidden
        />
      ) : (
        <span
          className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#FDEDE6] text-base font-bold text-[#A9432C] md:size-11"
          aria-hidden
        >
          {label.trim().slice(0, 1).toUpperCase() || "?"}
        </span>
      ),
      label,
      packed: counts.packed,
      total: counts.total,
      collapsed: collapsedGroups.has(groupKey),
      onToggleCollapsed: () => toggleGroupCollapsed(groupKey),
      onAdd: canEditContent ? () => openAddFromGroup(groupKey) : undefined,
    };
  }

  /** "All packed": the group has items, none are shown (packed ones hidden), and it is not folded. */
  function isAllPacked(groupKey: string, group: { items: PackingItem[]; total: number }): boolean {
    return group.total > 0 && group.items.length === 0 && !collapsedGroups.has(groupKey);
  }

  /** Small category label inside a person group (person view). */
  function renderPersonCategorySubHeader(category: PackingCategory, groupKey: string) {
    if (collapsedGroups.has(groupKey)) return null;
    return (
      <li
        key={`sub-${category.id}`}
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
        className={`${SUB_HEADER_CLASS} text-left`}
      >
        {category.name}
      </li>
    );
  }

  /** Person label inside a category (category view). Same look as the category label inside a person (person view). */
  function renderPersonBlockSubHeader(block: PersonBlock, categoryId: string) {
    if (collapsedGroups.has(categoryId)) return null;
    return (
      <li
        key={`person-${categoryId}-${block.participantId ?? "everyone"}`}
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
        className={`${SUB_HEADER_CLASS} text-left`}
      >
        {block.label}
      </li>
    );
  }

  /** The assignee of an item, as the drag rules compare it. */
  function assigneeOf(item: PackingItem): string | null {
    return item.assigned_to_participant_id ?? null;
  }

  /**
   * Reorder inside one category (category view). With person sub-headers, a drop that puts an item into
   * another person's block changes nothing; a drop inside the person's own block saves only that person's order.
   */
  function handleCategoryReorder(newOrderedItems: PackingItem[]) {
    if (!onReorderGroup) return;
    if (!showPersonGroups) return onReorderGroup(newOrderedItems);
    const categoryId = newOrderedItems[0]?.category_id;
    const shown = itemsByCategory.find(({ category }) => category.id === categoryId)?.items ?? [];
    if (shown.length !== newOrderedItems.length) return;
    // Crossing into another person's block moves an item to a position owned by someone else.
    for (let i = 0; i < shown.length; i++) {
      if (assigneeOf(shown[i]) !== assigneeOf(newOrderedItems[i])) return;
    }
    const moved = newOrderedItems.find((it, i) => it.id !== shown[i].id);
    if (!moved) return;
    const owner = assigneeOf(moved);
    return onReorderGroup(newOrderedItems.filter((i) => assigneeOf(i) === owner));
  }

  /**
   * A single list row. Both view modes and all three drag states route through
   * here, so the row markup has one home.
   */
  function renderItemRow(
    item: PackingItem,
    dragHandle?: React.ReactNode,
    isDragging?: boolean
  ) {
    return (
      <PackingItemRow
        item={item}
        personTag={null}
        canEdit={canEditContent}
        error={itemError?.id === item.id && editorItemId !== item.id ? itemError.message : null}
        onToggle={() => handleTogglePacked(item)}
        onOpenEditor={() => openEditor(item)}
        onDeleteRequest={() => openEditor(item, true)}
        lingerStartedAt={lingering.get(item.id)}
        dragHandle={dragHandle}
        isDragging={isDragging}
      />
    );
  }

  /**
   * The same row, wrapped as a dnd-kit sortable `<li>`.
   *
   * A row in a collapsed group is hidden rather than skipped: dnd-kit keeps its
   * refs attached, so the group stays a valid drop target while folded — the
   * droppable is the group container, not the row list.
   */
  function renderSortableRow(
    item: PackingItem,
    { setNodeRef, style, attributes, listeners, isDragging }: SortableGroupListSortableProps,
    groupKey: string
  ) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        // select-none and no touch callout: a press-and-hold drag must not select the name or open the iOS menu.
        className={`group list-none ${canEditContent ? "select-none [-webkit-touch-callout:none]" : ""} ${
          collapsedGroups.has(groupKey) ? "hidden" : ""
        }`}
        // Press-and-hold anywhere on the row starts a touch drag (the TouchSensor delay keeps a short tap a tap).
        // Mouse and keyboard drags still start from the handle only.
        onTouchStart={
          canEditContent ? (listeners.onTouchStart as React.TouchEventHandler<HTMLLIElement> | undefined) : undefined
        }
      >
        {renderItemRow(
          item,
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

  const peopleProgress: PackingPersonProgress[] = [];
  {
    const everyone = items.filter((i) => !i.assigned_to_participant_id);
    if (everyone.length > 0) {
      peopleProgress.push({
        key: PACKING_GROUP_KEY_EVERYONE,
        label: "Everyone",
        avatarUrl: getParticipantAvatarUrl(null),
        packed: everyone.filter((i) => i.is_packed).length,
        total: everyone.length,
      });
    }
    participants.forEach((p) => {
      const mine = items.filter((i) => i.assigned_to_participant_id === p.id);
      if (mine.length === 0) return;
      peopleProgress.push({
        key: p.id,
        label: p.name,
        avatarUrl: getParticipantAvatarUrl(p.id),
        packed: mine.filter((i) => i.is_packed).length,
        total: mine.length,
      });
    });
  }

  function openAddItem() {
    setAddCategoryId(categories[0]?.id ?? "");
    setAddModalMode("add-item");
    setAddModalOpen(true);
  }
  function openDeleteAll() {
    setManageListStartAtDelete(true);
    setManageListOpen(true);
  }

  const titleUnderline = (
    <svg width="96" height="10" viewBox="0 0 96 10" fill="none" aria-hidden="true" className="-mt-0.5">
      <path
        d="M2 6.5c10-3.2 21-3.6 31-1.4 9 2 17 1.6 26-.6 11-2.6 22-2.4 35 .4"
        stroke="#E07A5F"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );

  const showPackedCheckbox = (
    <button
      type="button"
      aria-pressed={showPacked}
      className={`inline-flex min-h-11 items-center gap-2.5 rounded-lg text-sm font-semibold text-[#2E2A27] ${PACKING_FOCUS}`}
      onClick={() => setShowPacked(!showPacked)}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-md border-2 ${
          showPacked ? "border-[#E07A5F] bg-[#E07A5F] text-white" : "border-[#E9D5C6] bg-white"
        }`}
        aria-hidden
      >
        {showPacked && <HandDrawnIcon name="check" size={15} />}
      </span>
      Show packed items ({packedCount})
    </button>
  );

  return (
    <div className="mt-8">
      <ManagePackingCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        tripId={tripId}
        categories={categories}
        items={items}
        onSuccess={onRefresh}
      />

      <ManagePackingListDialog
        open={manageListOpen}
        onOpenChange={setManageListOpen}
        tripId={tripId}
        itemCount={items.length}
        startAtDelete={manageListStartAtDelete}
        onRefresh={onRefresh}
        onSuccessMessage={setListManagementMessage}
      />

      <PackingItemEditorDialog
        open={editorItem !== null && canEditContent}
        onOpenChange={(next) => {
          if (!next) closeEditor();
        }}
        item={editorItem}
        categories={categories}
        participants={participants}
        saving={editSaving}
        error={editorItem && itemError?.id === editorItem.id ? itemError.message : null}
        onSave={handleSaveEdit}
        onDelete={() => {
          if (editorItem) void handleDelete(editorItem.id);
        }}
        deleting={editorItem !== null && deletingId === editorItem.id}
        initialConfirmDelete={editorConfirmDelete}
        usualSlot={
          editorItem ? (
            <div className="text-sm" dir="ltr">
              {usualPrompt?.itemId === editorItem.id ? (
                <div className="flex flex-wrap items-center gap-2 text-[#4A4A4A]">
                  {usualPrompt.usualItemId ? (
                    <>
                      <span>Already in your usual stuff. Update quantity to {usualPrompt.quantity}?</span>
                      <button
                        type="button"
                        className="font-medium text-[#E07A5F] hover:text-[#c46950] focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none disabled:opacity-50"
                        disabled={usualBusy}
                        onClick={handleUpdateUsualQuantity}
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        className="font-medium text-[#9B7B6B] hover:text-[#4A4A4A] focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none disabled:opacity-50"
                        disabled={usualBusy}
                        onClick={() => setUsualPrompt(null)}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <span>Already in your usual stuff.</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="font-medium text-[#E07A5F] hover:text-[#c46950] focus-visible:ring-2 focus-visible:ring-[#E07A5F]/40 focus-visible:outline-none disabled:opacity-50"
                  disabled={usualBusy}
                  onClick={() => handleAddItemToUsual(editorItem)}
                >
                  Add to my usual stuff
                </button>
              )}
              {usualError?.key === editorItem.id ? (
                <p className="mt-1 text-red-600" role="alert">
                  {usualError.message}
                </p>
              ) : null}
            </div>
          ) : null
        }
      />

      <AddFromUsualStuffDialog
        open={fromUsualOpen}
        onOpenChange={setFromUsualOpen}
        tripId={tripId}
        categories={categories}
        items={items}
        participants={participants}
        onRefresh={onRefresh}
        onSuccessMessage={setListManagementMessage}
      />

      {listManagementMessage ? (
        <div
          className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-sm text-[#2e7d32]"
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

      <div className="mt-5 flex flex-wrap gap-7">
        <div className="flex min-w-0 flex-col gap-4" style={{ flex: "1 1 300px" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[30px] font-extrabold leading-tight text-[#2E2A27] md:text-[34px]">
                Packing
              </h2>
              {titleUnderline}
              {!canEditContent && (
                <p className="mt-1 text-sm text-[#7A6A5E]">Read-only — you can view but not edit</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              {items.length > 0 && (
                <button
                  type="button"
                  aria-label="Share list"
                  className={`${PACKING_ICON_BUTTON_CLASS} ${PACKING_FOCUS}`}
                  onClick={handleShare}
                >
                  <HandDrawnIcon name="share" size={22} />
                </button>
              )}
              {canEditContent && (
                <PackingListMenu
                  onManageCategories={() => setManageCategoriesOpen(true)}
                  onDeleteAll={openDeleteAll}
                  canDeleteAll={items.length > 0}
                />
              )}
            </div>
          </div>

          <PackingProgressCard packed={packedCount} total={totalCount} canEdit={canEditContent} />

          <div className="hidden md:block">
            <PackingPeopleProgress people={peopleProgress} />
          </div>

          {items.length > 0 && (
            <div className="hidden md:block">
              <button
                type="button"
                className={`${PACKING_SECONDARY_BUTTON_CLASS} ${PACKING_FOCUS}`}
                onClick={handleShare}
              >
                <HandDrawnIcon name="share" size={20} />
                Share list
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0" style={{ flex: "999 1 560px" }}>
          {/* Read-only viewers still get the desktop search; the phone has nothing else to show them. */}
          <div className={canEditContent ? "mb-4" : "mb-4 hidden md:block"}>
            <PackingToolbar
              onAddItem={openAddItem}
              onFromUsual={() => setFromUsualOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onManageCategories={() => setManageCategoriesOpen(true)}
              onDeleteAll={openDeleteAll}
              canDeleteAll={items.length > 0}
              canEdit={canEditContent}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full bg-[#F6EEE7] p-1" role="group" aria-label="Group items">
              {(
                [
                  ["category", "By category"],
                  ["participant", "By person"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${PACKING_FOCUS} ${
                    viewMode === mode
                      ? "bg-white text-[#2E2A27] shadow-[0_1px_4px_rgba(120,70,40,0.12)]"
                      : "text-[#7A6A5E] hover:text-[#2E2A27]"
                  }`}
                  onClick={() => setViewMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { key: "all", label: "All", avatar: undefined as string | null | undefined },
                { key: "everyone", label: "Everyone", avatar: undefined },
                ...participants.map((p, i) => ({
                  key: p.id,
                  label: p.name,
                  avatar: participantAvatarUrls[i] ?? null,
                })),
              ]
            ).map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={assigneeFilter === chip.key}
                className={`flex shrink-0 items-center min-h-11 gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold md:min-h-9 ${PACKING_FOCUS} ${
                  assigneeFilter === chip.key
                    ? "bg-[#E07A5F] text-[#2B1610]"
                    : "border border-[#EFE3D8] bg-white text-[#2E2A27] hover:bg-[#FDEDE6]"
                }`}
                onClick={() => setAssigneeFilter(chip.key)}
              >
                {chip.avatar !== undefined &&
                  (chip.avatar ? (
                    <img
                      src={chip.avatar}
                      alt=""
                      loading="lazy"
                      className="size-6 shrink-0 rounded-full object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#F6EEE7] text-xs font-bold text-[#7A6A5E]"
                      aria-hidden
                    >
                      {chip.label.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                  ))}
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

      <div className="mt-6">
        {viewMode === "category" && canEditContent && onReorderGroup && onMoveItem ? (
          <GroupedSortableList<PackingItem>
            groups={itemsByCategory.map(({ category, items }) => ({ groupKey: category.id, items }))}
            groupingMeta={(() => {
              const meta = getPackingGroupingMode("category");
              return { field: meta.field, groupKeyToFieldValue: (k: string) => meta.groupKeyToFieldValue(k) };
            })()}
            onReorder={(_groupKey, newOrderedItems) => handleCategoryReorder(newOrderedItems)}
            onMove={(item, fromGroupKey, toGroupKey, insertIndex) => {
              // insertIndex counts the rows shown (the assignee/search filters and hidden packed items
              // may leave some out); the saved order covers the whole category.
              const shown = itemsByCategory.find(({ category }) => category.id === toGroupKey)?.items ?? [];
              const anchor = shown[insertIndex];
              const whole = items.filter((i) => i.category_id === toGroupKey && i.id !== item.id);
              let wholeIndex = anchor ? whole.findIndex((i) => i.id === anchor.id) : whole.length;
              if (showPersonGroups && !(anchor && assigneeOf(anchor) === assigneeOf(item))) {
                // With person sub-headers the item keeps its person: it goes after that person's last item
                // in the target category (or at the end when they have none there yet), never into someone else's block.
                const owner = assigneeOf(item);
                let lastOfOwner = -1;
                whole.forEach((i, idx) => {
                  if (assigneeOf(i) === owner) lastOfOwner = idx;
                });
                wholeIndex = lastOfOwner === -1 ? whole.length : lastOfOwner + 1;
              }
              return onMoveItem!("category", item, fromGroupKey, toGroupKey, wholeIndex === -1 ? whole.length : wholeIndex);
            }}
            renderGroupHeader={(groupKey) => {
              const entry = itemsByCategory.find(({ category }) => category.id === groupKey);
              if (!entry) return null;
              return <PackingGroupCardHeader {...categoryHeaderProps(entry.category, entry)} />;
            }}
            renderItem={(item, sortable) => {
              const block = personBlockStarts.get(item.id);
              return (
                <>
                  {block && !sortable.isOverlay && renderPersonBlockSubHeader(block, item.category_id)}
                  {renderSortableRow(
                    item,
                    sortable,
                    item.category_id
                  )}
                </>
              );
            }}
            listTag="ul"
            listClassName={ITEM_LIST_CLASS}
            touchDelayMs={TOUCH_DRAG_DELAY_MS}
            groupClassName={PACKING_GROUP_CARD_CLASS}
            containerClassName={GROUP_GRID_CLASS}
            // Every category here has items; an empty list means they are all packed and hidden.
            renderEmptyGroup={() => null}
            disabled={!canEditContent}
            renderGroupFooter={(groupKey) => {
              const entry = itemsByCategory.find(({ category }) => category.id === groupKey);
              return entry && isAllPacked(groupKey, entry) ? <PackingAllPacked /> : null;
            }}
          />
        ) : viewMode === "category" && (
          <div className={GROUP_GRID_CLASS}>
            {itemsByCategory.map((entry) => {
              const { category, items: catItems } = entry;
              return (
                <PackingGroupCard
                  key={category.id}
                  {...categoryHeaderProps(category, entry)}
                  allPacked={isAllPacked(category.id, entry)}
                >
                  {canEditContent && onReorderGroup ? (
                    <SortableGroupList<PackingItem>
                      items={catItems}
                      onReorder={handleCategoryReorder}
                      as="ul"
                      className={ITEM_LIST_CLASS}
                      touchDelayMs={TOUCH_DRAG_DELAY_MS}
                      disabled={!canEditContent}
                    >
                      {(item, sortable) => {
                        const block = personBlockStarts.get(item.id);
                        return (
                          <>
                            {block && renderPersonBlockSubHeader(block, item.category_id)}
                            {renderSortableRow(
                              item,
                              sortable,
                              item.category_id
                            )}
                          </>
                        );
                      }}
                    </SortableGroupList>
                  ) : (
                    <ul className={ITEM_LIST_CLASS} role="list" hidden={collapsedGroups.has(category.id)}>
                      {catItems.map((item) => {
                        const block = personBlockStarts.get(item.id);
                        return (
                          <Fragment key={item.id}>
                            {block && renderPersonBlockSubHeader(block, category.id)}
                            <li className="group list-none">
                              {renderItemRow(item)}
                            </li>
                          </Fragment>
                        );
                      })}
                    </ul>
                  )}
                </PackingGroupCard>
              );
            })}
          </div>
        )}

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
            // Person view never changes the order: a drop inside the same person does nothing.
            onReorder={() => {}}
            onMove={(item, fromGroupKey, toGroupKey, insertIndex) => onMoveItem!("participant", item, fromGroupKey, toGroupKey, insertIndex)}
            renderGroupHeader={(groupKey) => {
              const part = itemsByParticipant.find(
                (p) => (p.participantId ?? PACKING_GROUP_KEY_EVERYONE) === groupKey
              );
              if (!part) return null;
              return (
                <PackingGroupCardHeader
                  {...participantHeaderProps(groupKey, part.label, part.participantId, part)}
                />
              );
            }}
            renderItem={(item, sortable) => {
              const groupKey = item.assigned_to_participant_id ?? PACKING_GROUP_KEY_EVERYONE;
              const startOf = personCategoryStarts.get(item.id);
              return (
                <>
                  {startOf && !sortable.isOverlay && renderPersonCategorySubHeader(startOf, groupKey)}
                  {renderSortableRow(item, sortable, groupKey)}
                </>
              );
            }}
            listTag="ul"
            listClassName={ITEM_LIST_CLASS}
            touchDelayMs={TOUCH_DRAG_DELAY_MS}
            groupClassName={PACKING_GROUP_CARD_CLASS}
            containerClassName={GROUP_GRID_CLASS}
            renderEmptyGroup={(groupKey) => {
              // "Everyone" is always listed so items can be dropped on it; with nothing assigned it says so.
              // A person whose items are all packed and hidden shows "All packed" (footer) instead.
              const part = itemsByParticipant.find(
                (p) => (p.participantId ?? PACKING_GROUP_KEY_EVERYONE) === groupKey
              );
              if ((part && part.total > 0) || collapsedGroups.has(groupKey)) return null;
              return (
                <li className="py-3 text-center text-sm text-[#7A6A5E]" aria-hidden>
                  Drop here or add item
                </li>
              );
            }}
            disabled={!canEditContent}
            renderGroupFooter={(groupKey) => {
              const part = itemsByParticipant.find(
                (p) => (p.participantId ?? PACKING_GROUP_KEY_EVERYONE) === groupKey
              );
              return part && isAllPacked(groupKey, part) ? <PackingAllPacked /> : null;
            }}
          />
        ) : viewMode === "participant" && (
          <div className={GROUP_GRID_CLASS}>
            {itemsByParticipant.map((part) => {
              const { label, participantId, items: partItems } = part;
              const groupKey = participantId ?? PACKING_GROUP_KEY_EVERYONE;
              return (
                <PackingGroupCard
                  key={groupKey}
                  {...participantHeaderProps(groupKey, label, participantId, part)}
                  allPacked={isAllPacked(groupKey, part)}
                >
                  {canEditContent && onReorderGroup ? (
                    <SortableGroupList<PackingItem>
                      items={partItems}
                      onReorder={() => {}}
                      as="ul"
                      className={ITEM_LIST_CLASS}
                      touchDelayMs={TOUCH_DRAG_DELAY_MS}
                      disabled={!canEditContent}
                    >
                      {(item, sortable) => {
                        const startOf = personCategoryStarts.get(item.id);
                        return (
                          <>
                            {startOf && renderPersonCategorySubHeader(startOf, groupKey)}
                            {renderSortableRow(item, sortable, groupKey)}
                          </>
                        );
                      }}
                    </SortableGroupList>
                  ) : (
                    <ul className={ITEM_LIST_CLASS} role="list" hidden={collapsedGroups.has(groupKey)}>
                      {partItems.map((item) => {
                        const startOf = personCategoryStarts.get(item.id);
                        return (
                          <Fragment key={item.id}>
                            {startOf && renderPersonCategorySubHeader(startOf, groupKey)}
                            <li className="group list-none">
                              {renderItemRow(item)}
                            </li>
                          </Fragment>
                        );
                      })}
                    </ul>
                  )}
                </PackingGroupCard>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && filteredItems.length === 0 && (
        <p className="mt-6 text-sm text-[#6B5B50]">No items match.</p>
      )}

      {/* Below all the cards, on phone and desktop. Only when it can change something: some item is packed, or it is on. */}
      {(packedCount > 0 || showPacked) && <div className="mt-4">{showPackedCheckbox}</div>}
        </div>
      </div>

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
