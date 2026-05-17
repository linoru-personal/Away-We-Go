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

export async function updatePackingItemsSortOrders(
  supabase: SupabaseClient,
  rows: { id: string; sort_order: number }[],
  context: PackingItemUpdateContext
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };

  const results = await Promise.all(
    rows.map((row) =>
      updatePackingItem(supabase, row.id, { sort_order: row.sort_order }, context)
    )
  );

  const failed = results.find((r) => r.error);
  return { error: failed?.error ?? null };
}
