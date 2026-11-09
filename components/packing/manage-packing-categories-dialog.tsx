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
import { CategoryManagerList } from "./category-manager-list";
import type { PackingCategory, PackingItem } from "./packing-list";

export interface ManagePackingCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  categories: PackingCategory[];
  items: PackingItem[];
  onSuccess: () => void | Promise<void>;
}

export function ManagePackingCategoriesDialog({
  open,
  onOpenChange,
  tripId,
  categories: initialCategories,
  items,
  onSuccess,
}: ManagePackingCategoriesDialogProps) {
  const [categories, setCategories] = useState<PackingCategory[]>(initialCategories);

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
    const sortOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order)) + 1
        : 0;
    const { data, error: insertError } = await supabase
      .from("packing_categories")
      .insert({
        trip_id: tripId,
        name,
        icon: icon ?? PACKING_DEFAULT_ICON,
        sort_order: sortOrder,
      })
      .select("id, trip_id, name, icon, sort_order")
      .single();
    if (insertError) throw new Error(insertError.message);
    setCategories((prev) => [...prev, data as PackingCategory]);
    await Promise.resolve(onSuccess());
  };

  const handleUpdate = async (id: string, name: string, icon: CategoryIconKey) => {
    const { data, error: updateError } = await supabase
      .from("packing_categories")
      .update({ name, icon: icon ?? PACKING_DEFAULT_ICON })
      .eq("id", id)
      .eq("trip_id", tripId)
      .select("id, trip_id, name, icon, sort_order")
      .single();
    if (updateError) throw new Error(updateError.message);
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? (data as PackingCategory) : c))
    );
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
        .filter((c): c is PackingCategory => c !== null)
    );
    const { error: rpcError } = await supabase.rpc("reorder_packing_categories", {
      p_trip_id: tripId,
      p_ids: orderedIds,
    });
    if (rpcError) {
      setCategories(previous);
      throw new Error(rpcError.message);
    }
    await Promise.resolve(onSuccess());
  };

  const handleDelete = async (id: string, moveTo: string | null) => {
    const { error: rpcError } = await supabase.rpc("delete_packing_category", {
      p_category_id: id,
      p_move_to: moveTo,
    });
    if (rpcError) throw new Error(rpcError.message);
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
