"use client";

import React, { useCallback, useId, useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import type { SortableItem } from "./sortable-group-list";
import type { SortableGroupListSortableProps } from "./sortable-group-list";

const GROUP_DROPPABLE_PREFIX = "group:";

function isGroupDroppableId(id: string | number): boolean {
  return String(id).startsWith(GROUP_DROPPABLE_PREFIX);
}

function parseGroupKey(droppableId: string | number): string {
  return String(droppableId).slice(GROUP_DROPPABLE_PREFIX.length);
}

export type GroupedSortableGroup<T extends SortableItem> = {
  groupKey: string;
  items: T[];
};

export type GroupingMeta = {
  field: string;
  groupKeyToFieldValue: (groupKey: string) => unknown;
};

export interface GroupedSortableListProps<T extends SortableItem> {
  /** Each group has a stable key (e.g. category id, or "__everyone__" for participant null). */
  groups: GroupedSortableGroup<T>[];
  /** Grouping metadata: which item field to set and how to map group key → value. */
  groupingMeta: GroupingMeta;
  /** Called when items are reordered within the same group. */
  onReorder: (groupKey: string, newOrderedItems: T[]) => void | Promise<void>;
  /** Called when an item is dropped into a different group. */
  onMove: (item: T, fromGroupKey: string, toGroupKey: string, insertIndex: number) => void | Promise<void>;
  /** Render the group header (title, icon, etc.). */
  renderGroupHeader: (groupKey: string) => React.ReactNode;
  /** Render each item; receives sortable props for drag. Put listeners on the drag handle only. */
  renderItem: (item: T, sortableProps: SortableGroupListSortableProps) => React.ReactNode;
  /** Optional footer per group (e.g. "Add item" link). */
  renderGroupFooter?: (groupKey: string) => React.ReactNode;
  disabled?: boolean;
  listTag?: "ul" | "div";
  listClassName?: string;
  /** Optional class for the group container (card). */
  groupClassName?: string;
}

function SortableRow<T extends SortableItem>({
  item,
  disabled,
  children,
}: {
  item: T;
  disabled: boolean;
  children: (item: T, sortableProps: SortableGroupListSortableProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      {children(item, {
        setNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown>,
        style,
        isDragging,
      })}
    </>
  );
}

function GroupColumn<T extends SortableItem>({
  group,
  renderGroupHeader,
  renderItem,
  renderGroupFooter,
  disabled,
  listTag: ListTag,
  listClassName,
  groupClassName,
}: {
  group: GroupedSortableGroup<T>;
  renderGroupHeader: (groupKey: string) => React.ReactNode;
  renderItem: (item: T, sortableProps: SortableGroupListSortableProps) => React.ReactNode;
  renderGroupFooter?: (groupKey: string) => React.ReactNode;
  disabled: boolean;
  listTag: "ul" | "div";
  listClassName?: string;
  groupClassName?: string;
}) {
  const droppableId = GROUP_DROPPABLE_PREFIX + group.groupKey;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const itemIds = group.items.map((i) => i.id);

  return (
    <div
      ref={setNodeRef}
      className={`${groupClassName ?? ""} transition-[box-shadow,background-color] duration-150 ${isOver ? "shadow-lg bg-[#F5F3F0]/40" : ""}`}
      data-droppable-group={group.groupKey}
    >
      {renderGroupHeader(group.groupKey)}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ListTag className={listClassName} role={ListTag === "ul" ? "list" : undefined}>
          {group.items.length === 0 ? (
            ListTag === "ul" ? (
              <li className="py-3 text-center text-sm text-[#9B7B6B]/80" aria-hidden>
                Drop here or add item
              </li>
            ) : (
              <div className="py-3 text-center text-sm text-[#9B7B6B]/80">
                Drop here or add item
              </div>
            )
          ) : (
            group.items.map((item) => (
              <SortableRow key={item.id} item={item} disabled={disabled}>
                {renderItem}
              </SortableRow>
            ))
          )}
        </ListTag>
      </SortableContext>
      {renderGroupFooter?.(group.groupKey)}
    </div>
  );
}

/**
 * Renders multiple groups in a single DndContext so items can be reordered within a group
 * or moved to another group. Vertical axis and parent element restricted. Use a drag handle for drag start.
 */
export function GroupedSortableList<T extends SortableItem>({
  groups,
  groupingMeta,
  onReorder,
  onMove,
  renderGroupHeader,
  renderItem,
  renderGroupFooter,
  disabled = false,
  listTag = "ul",
  listClassName,
  groupClassName,
}: GroupedSortableListProps<T>) {
  const dndId = useId();

  const itemIdToGroupKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const item of g.items) m.set(item.id, g.groupKey);
    }
    return m;
  }, [groups]);

  const getItemById = useCallback(
    (id: string): T | null => {
      for (const g of groups) {
        const item = g.items.find((i) => i.id === id);
        if (item) return item as T;
      }
      return null;
    },
    [groups]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const fromGroupKey = itemIdToGroupKey.get(activeId);
      if (!fromGroupKey) return;

      const activeItem = getItemById(activeId);
      if (!activeItem) return;

      if (isGroupDroppableId(overId)) {
        const toGroupKey = parseGroupKey(overId);
        if (fromGroupKey === toGroupKey) return;
        const toGroup = groups.find((g) => g.groupKey === toGroupKey);
        const insertIndex = toGroup ? toGroup.items.length : 0;
        onMove(activeItem, fromGroupKey, toGroupKey, insertIndex);
        return;
      }

      const toItem = getItemById(overId);
      if (!toItem) return;
      const toGroupKey = itemIdToGroupKey.get(overId);
      if (!toGroupKey) return;

      if (fromGroupKey === toGroupKey) {
        const group = groups.find((g) => g.groupKey === fromGroupKey);
        if (!group) return;
        const oldIndex = group.items.findIndex((i) => i.id === activeId);
        const newIndex = group.items.findIndex((i) => i.id === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(group.items, oldIndex, newIndex);
        onReorder(fromGroupKey, reordered);
        return;
      }

      const toGroup = groups.find((g) => g.groupKey === toGroupKey);
      const insertIndex = toGroup ? toGroup.items.findIndex((i) => i.id === overId) : 0;
      if (insertIndex === -1) return;
      onMove(activeItem, fromGroupKey, toGroupKey, insertIndex);
    },
    [groups, itemIdToGroupKey, getItemById, onReorder, onMove]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
      {groups.map((group) => (
        <GroupColumn
          key={group.groupKey}
          group={group}
          renderGroupHeader={renderGroupHeader}
          renderItem={renderItem}
          renderGroupFooter={renderGroupFooter}
          disabled={disabled}
          listTag={listTag}
          listClassName={listClassName}
          groupClassName={groupClassName}
        />
      ))}
      </div>
    </DndContext>
  );
}
