import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UsualCategory,
  UsualItem,
  UsualRowInput,
} from "@/lib/usual-stuff/types";

const ITEM_COLUMNS =
  "id, list_id, category_id, title, quantity, person_label, is_always, sort_order, created_at";
const CATEGORY_COLUMNS = "id, list_id, name, icon, sort_order";

const DUPLICATE_MESSAGE = "Already in your usual stuff";

type PgError = { code?: string; message: string };

function itemError(error: PgError): Error {
  if (error.code === "23505") return new Error(DUPLICATE_MESSAGE);
  return new Error(error.message);
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function loadMyUsualStuff(
  s: SupabaseClient
): Promise<{ listId: string; categories: UsualCategory[]; items: UsualItem[] }> {
  const { data: listId, error: listError } = await s.rpc(
    "get_or_create_my_usual_list"
  );
  if (listError) throw new Error(listError.message);
  if (typeof listId !== "string" || !listId) {
    throw new Error("Could not load your usual stuff.");
  }

  const { data: categories, error: catError } = await s
    .from("usual_categories")
    .select(CATEGORY_COLUMNS)
    .eq("list_id", listId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (catError) throw new Error(catError.message);

  const { data: items, error: itemsError } = await s
    .from("usual_items")
    .select(ITEM_COLUMNS)
    .eq("list_id", listId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  return {
    listId,
    categories: (categories ?? []) as UsualCategory[],
    items: (items ?? []) as UsualItem[],
  };
}

export async function addToMyUsualStuff(
  s: SupabaseClient,
  rows: UsualRowInput[]
): Promise<{ added: number; skipped: { index: number; usual_item_id: string }[] }> {
  const { data, error } = await s.rpc("add_to_my_usual_stuff", { p_rows: rows });
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as {
    added?: number;
    skipped?: { index: number; usual_item_id: string }[];
  };
  return { added: result.added ?? 0, skipped: result.skipped ?? [] };
}

export async function addUsualItemsToTrip(
  s: SupabaseClient,
  tripId: string,
  rows: { usual_item_id: string; participant_id: string | null }[]
): Promise<{ added: number; skipped: number }> {
  const { data, error } = await s.rpc("add_usual_items_to_trip", {
    p_trip_id: tripId,
    p_rows: rows,
  });
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { added?: number; skipped?: number };
  return { added: result.added ?? 0, skipped: result.skipped ?? 0 };
}

export async function updateUsualItem(
  s: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<
      UsualItem,
      "title" | "quantity" | "category_id" | "person_label" | "is_always"
    >
  >
): Promise<void> {
  const { error } = await s.from("usual_items").update(patch).eq("id", id);
  if (error) throw itemError(error);
}

export async function deleteUsualItem(
  s: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await s.from("usual_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertUsualItem(
  s: SupabaseClient,
  listId: string,
  item: Pick<
    UsualItem,
    "category_id" | "title" | "quantity" | "person_label" | "is_always"
  >
): Promise<UsualItem> {
  const { data: last, error: maxError } = await s
    .from("usual_items")
    .select("sort_order")
    .eq("category_id", item.category_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (maxError) throw new Error(maxError.message);

  const lastRow = (last ?? [])[0] as { sort_order: number } | undefined;
  const sortOrder = lastRow ? lastRow.sort_order + 1 : 0;

  const { data, error } = await s
    .from("usual_items")
    .insert({
      list_id: listId,
      category_id: item.category_id,
      title: item.title,
      quantity: item.quantity,
      person_label: item.person_label,
      is_always: item.is_always,
      sort_order: sortOrder,
    })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw itemError(error);
  if (!data) throw new Error("Could not add item.");
  return data as UsualItem;
}

export async function reorderUsualItems(
  s: SupabaseClient,
  categoryId: string,
  ids: string[]
): Promise<void> {
  const { error } = await s.rpc("reorder_usual_items", {
    p_category_id: categoryId,
    p_ids: ids,
  });
  if (error) throw new Error(error.message);
}

export async function reorderUsualCategories(
  s: SupabaseClient,
  ids: string[]
): Promise<void> {
  const { error } = await s.rpc("reorder_usual_categories", { p_ids: ids });
  if (error) throw new Error(error.message);
}

export async function deleteUsualCategory(
  s: SupabaseClient,
  id: string,
  moveTo: string | null
): Promise<void> {
  const { error } = await s.rpc("delete_usual_category", {
    p_category_id: id,
    p_move_to: moveTo,
  });
  if (error) throw new Error(error.message);
}

export async function upsertUsualCategory(
  s: SupabaseClient,
  listId: string,
  c: { id?: string; name: string; icon: string }
): Promise<UsualCategory> {
  const name = c.name.trim();
  if (!name) throw new Error("Category name is required.");

  if (c.id) {
    const { data, error } = await s
      .from("usual_categories")
      .update({ name, icon: c.icon })
      .eq("id", c.id)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not update category.");
    return data as UsualCategory;
  }

  const { data: last, error: maxError } = await s
    .from("usual_categories")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (maxError) throw new Error(maxError.message);

  const lastRow = (last ?? [])[0] as { sort_order: number } | undefined;
  const sortOrder = lastRow ? lastRow.sort_order + 1 : 0;

  const { data, error } = await s
    .from("usual_categories")
    .insert({ list_id: listId, name, icon: c.icon, sort_order: sortOrder })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create category.");
  return data as UsualCategory;
}
