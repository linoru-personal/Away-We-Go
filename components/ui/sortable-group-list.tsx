"use client";

import React, { useCallback, useId } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

/** Item must have id and sort_order for reorder persistence. */
export type SortableItem = { id: string; sort_order: number };

export type SortableGroupListSortableProps = {
  setNodeRef: (element: HTMLElement | null) => void;
  /** Spread onto the drag handle only (from useSortable) so drag starts from handle. */
  attributes: Record<string, unknown>;
  /** Spread onto the drag handle only (from useSortable). */
  listeners: Record<string, unknown>;
  style: React.CSSProperties;
  isDragging: boolean;
};

export interface SortableGroupListProps<T extends SortableItem> {
  /** Items in this group only (one group = one SortableGroupList). */
  items: T[];
  /** Called with items in new order after a drag. Parent should update local state and persist. */
  onReorder: (newOrderedItems: T[]) => void | Promise<void>;
  /** Render each item. Put listeners on the drag handle only. */
  children: (item: T, sortableProps: SortableGroupListSortableProps) => React.ReactNode;
  /** When true, dragging is disabled (e.g. read-only). */
  disabled?: boolean;
  /** List element type. Default "ul". */
  as?: "ul" | "div";
  /** Class name for the list container. */
  className?: string;
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

/**
 * Renders a single group's list as sortable. One DndContext per group so drag is limited to this list.
 * Vertical axis and parent element restricted. Use a drag handle for drag start.
 */
export function SortableGroupList<T extends SortableItem>({
  items,
  onReorder,
  children,
  disabled = false,
  as: ListTag = "ul",
  className,
}: SortableGroupListProps<T>) {
  const dndId = useId();
  const itemIds = items.map((i) => i.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(reordered);
    },
    [items, onReorder]
  );

  if (items.length === 0) {
    return <ListTag className={className} />;
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ListTag className={className} role={ListTag === "ul" ? "list" : undefined}>
          {items.map((item) => (
            <SortableRow key={item.id} item={item} disabled={disabled}>
              {children}
            </SortableRow>
          ))}
        </ListTag>
      </SortableContext>
    </DndContext>
  );
}
