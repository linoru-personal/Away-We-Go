import type { SupabaseClient } from "@supabase/supabase-js";

/** Fields that may be patched on packing_items. Omit keys that should not change. */
export type PackingItemPatch = {
  title?: string;
  quantity?: number;
  category_id?: string;
  is_packed?: boolean;
  sort_order?: number;
  assigned_to_participant_id?: string | null;
  assigned_to_user_id?: string | null;
};

export type PackingItemUpdateContext =
  | "toggle-packed"
  | "save-edit"
  | "reorder-sort"
  | "move-category"
  | "move-participant"
  | "category-fallback"
  | "template-import"
  | "other";

/**
 * Partial update for a single packing item. Logs payload for debugging assignment resets.
 * Never pass assignment fields unless intentionally changing assignment.
 */
export async function updatePackingItem(
  supabase: SupabaseClient,
  itemId: string,
  patch: PackingItemPatch,
  context: PackingItemUpdateContext
): Promise<{ error: Error | null }> {
  const keys = Object.keys(patch) as (keyof PackingItemPatch)[];
  if (keys.length === 0) {
    return { error: null };
  }

  console.log("[packing_items.update]", { context, itemId, patch });

  const { error } = await supabase
    .from("packing_items")
    .update(patch)
    .eq("id", itemId);

  if (error) {
    console.warn("[packing_items.update] failed", { context, itemId, patch, message: error.message });
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/** Deletes a single packing item. Logs failures like the other mutations here. */
export async function deletePackingItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<{ error: Error | null }> {
  console.log("[packing_items.delete]", { itemId });

  const { error } = await supabase.from("packing_items").delete().eq("id", itemId);

  if (error) {
    console.warn("[packing_items.delete] failed", { itemId, message: error.message });
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Puts the given items in `categoryId`, in the given order (sort_order = array index),
 * in one database call. Use for within-category reorder and for moves into a category.
 */
export async function reorderPackingItems(
  supabase: SupabaseClient,
  tripId: string,
  categoryId: string,
  orderedIds: string[]
): Promise<{ error: Error | null }> {
  if (orderedIds.length === 0) return { error: null };

  const { error } = await supabase.rpc("reorder_packing_items", {
    p_trip_id: tripId,
    p_category_id: categoryId,
    p_ids: orderedIds,
  });

  if (error) {
    console.warn("[packing_items.reorder] failed", {
      tripId,
      categoryId,
      count: orderedIds.length,
      message: error.message,
    });
    return { error: new Error(error.message) };
  }

  return { error: null };
}
