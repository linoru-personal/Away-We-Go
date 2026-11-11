"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PACKING_DEFAULT_ICON,
  type CategoryIconKey,
} from "@/components/ui/category-icons";
import { CategoryManagerList } from "@/components/packing/category-manager-list";
import {
  deleteUsualCategory,
  reorderUsualCategories,
  upsertUsualCategory,
} from "@/lib/usual-stuff/queries";
import type { UsualCategory, UsualItem } from "@/lib/usual-stuff/types";

export interface ManageUsualCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  categories: UsualCategory[];
  items: UsualItem[];
  onSuccess: () => void | Promise<void>;
}

export function ManageUsualCategoriesDialog({
  open,
  onOpenChange,
  listId,
  categories: initialCategories,
  items,
  onSuccess,
}: ManageUsualCategoriesDialogProps) {
  const [categories, setCategories] = useState<UsualCategory[]>(initialCategories);

  const [syncedFrom, setSyncedFrom] = useState({ open, initialCategories });
  if (syncedFrom.open !== open || syncedFrom.initialCategories !== initialCategories) {
    setSyncedFrom({ open, initialCategories });
    if (open) setCategories(initialCategories);
  }

  const managed = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        sort_order: c.sort_order,
        itemCount: items.filter((i) => i.category_id === c.id).length,
      })),
    [categories, items]
  );

  const handleAdd = async (name: string, icon: CategoryIconKey) => {
    const created = await upsertUsualCategory(supabase, listId, {
      name,
      icon: icon ?? PACKING_DEFAULT_ICON,
    });
    setCategories((prev) => [...prev, created]);
    await Promise.resolve(onSuccess());
  };

  const handleUpdate = async (id: string, name: string, icon: CategoryIconKey) => {
    const updated = await upsertUsualCategory(supabase, listId, {
      id,
      name,
      icon: icon ?? PACKING_DEFAULT_ICON,
    });
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    await Promise.resolve(onSuccess());
  };

  const handleReorder = async (orderedIds: string[]) => {
    const previous = categories;
    const byId = new Map(categories.map((c) => [c.id, c]));
    setCategories(
      orderedIds
        .map((id, index) => {
          const c = byId.get(id);
          return c ? { ...c, sort_order: index } : null;
        })
        .filter((c): c is UsualCategory => c !== null)
    );
    try {
      await reorderUsualCategories(supabase, orderedIds);
    } catch (err) {
      setCategories(previous);
      throw err;
    }
    await Promise.resolve(onSuccess());
  };

  const handleDelete = async (id: string, moveTo: string | null) => {
    await deleteUsualCategory(supabase, id, moveTo);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await Promise.resolve(onSuccess());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1f1f1f]">
            Manage Categories
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
          <CategoryManagerList
            categories={managed}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onReorder={handleReorder}
            onDelete={handleDelete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
