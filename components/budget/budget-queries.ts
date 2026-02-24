import { supabase } from "@/app/lib/supabaseClient";

/** Budget feature is EXPENSES ONLY. All items are stored in trip_budget_items; totals use amount_base. No "planned" tables/fields. */
const BASE_CURRENCY = "USD";
const FX_RATES: Record<string, number> = {
  USD: 1,
  ISK: 0.00727,
};

function getFxRate(currency: string): number {
  const rate = FX_RATES[currency.toUpperCase()];
  if (rate == null) {
    throw new Error(`Unsupported currency: ${currency}. MVP supports USD and ISK.`);
  }
  return rate;
}

export type BudgetCategorySummary = {
  id: string;
  name: string;
  color: string;
  icon: string;
  total_base: number;
};

export type BudgetItemRow = {
  id: string;
  trip_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: string;
  amount_base: number;
  base_currency: string;
  fx_rate: number;
  date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type BudgetData = {
  items_count: number;
  categories_count: number;
  total_base: number;
  categories: BudgetCategorySummary[];
  itemsGrouped: {
    category: BudgetCategorySummary | null;
    items: BudgetItemRow[];
  }[];
};

export type CreateBudgetItemPayload = {
  name: string;
  amount: number;
  currency: string;
  categoryId: string | null;
  date?: string | null;
  notes?: string | null;
};

export type UpdateBudgetItemPayload = {
  name?: string;
  amount?: number;
  currency?: string;
  categoryId?: string | null;
  date?: string | null;
  notes?: string | null;
};

export type CreateBudgetCategoryPayload = {
  name: string;
  color: string;
  icon: string;
};

export async function fetchBudgetData(tripId: string): Promise<BudgetData> {
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase
      .from("trip_budget_categories")
      .select("id, name, color, icon")
      .eq("trip_id", tripId)
      .order("name", { ascending: true }),
    supabase
      .from("trip_budget_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
  ]);

  if (categoriesRes.error) {
    throw new Error(categoriesRes.error.message);
  }
  if (itemsRes.error) {
    throw new Error(itemsRes.error.message);
  }

  const categories = (categoriesRes.data ?? []) as {
    id: string;
    name: string;
    color: string;
    icon: string;
  }[];
  const items = (itemsRes.data ?? []) as BudgetItemRow[];

  const categoryTotals = new Map<string, number>();
  for (const item of items) {
    const key = item.category_id ?? "__uncategorized__";
    const current = categoryTotals.get(key) ?? 0;
    categoryTotals.set(key, current + Number(item.amount_base));
  }

  /** Totals computed from trip_budget_items.amount_base only (expenses). */
  const total_base = items.reduce((sum, i) => sum + Number(i.amount_base), 0);
  const categoriesWithTotal: BudgetCategorySummary[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    total_base: categoryTotals.get(c.id) ?? 0,
  }));

  const itemsByCategory = new Map<string | null, BudgetItemRow[]>();
  itemsByCategory.set(null, []);
  for (const c of categories) {
    itemsByCategory.set(c.id, []);
  }
  for (const item of items) {
    const key = item.category_id ?? null;
    const list = itemsByCategory.get(key) ?? [];
    list.push(item);
    itemsByCategory.set(key, list);
  }

  const itemsGrouped: BudgetData["itemsGrouped"] = [];

  for (const cat of categoriesWithTotal) {
    const groupItems = itemsByCategory.get(cat.id) ?? [];
    itemsGrouped.push({ category: cat, items: groupItems });
  }

  const uncategorizedItems = itemsByCategory.get(null) ?? [];
  if (uncategorizedItems.length > 0) {
    itemsGrouped.push({ category: null, items: uncategorizedItems });
  }

  return {
    items_count: items.length,
    categories_count: categories.length,
    total_base,
    categories: categoriesWithTotal,
    itemsGrouped,
  };
}

function toAmountBase(amount: number, currency: string): { amount_base: number; fx_rate: number } {
  const fx_rate = getFxRate(currency);
  const amount_base = amount * fx_rate;
  return { amount_base, fx_rate };
}

/** Inserts one expense item into trip_budget_items only. No planned tables. */
export async function createBudgetItem(
  tripId: string,
  payload: CreateBudgetItemPayload
): Promise<BudgetItemRow> {
  const { amount_base, fx_rate } = toAmountBase(payload.amount, payload.currency);

  const { data, error } = await supabase
    .from("trip_budget_items")
    .insert({
      trip_id: tripId,
      category_id: payload.categoryId ?? null,
      name: payload.name,
      amount: payload.amount,
      currency: payload.currency,
      amount_base,
      base_currency: BASE_CURRENCY,
      fx_rate,
      date: payload.date ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as BudgetItemRow;
}

/** Updates one expense item in trip_budget_items only. No planned tables. */
export async function updateBudgetItem(
  itemId: string,
  payload: UpdateBudgetItemPayload
): Promise<BudgetItemRow> {
  const updates: Record<string, unknown> = {};

  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.categoryId !== undefined) updates.category_id = payload.categoryId ?? null;
  if (payload.date !== undefined) updates.date = payload.date ?? null;
  if (payload.notes !== undefined) updates.notes = payload.notes ?? null;

  if (payload.amount !== undefined && payload.currency !== undefined) {
    const { amount_base, fx_rate } = toAmountBase(payload.amount, payload.currency);
    updates.amount = payload.amount;
    updates.currency = payload.currency;
    updates.amount_base = amount_base;
    updates.base_currency = BASE_CURRENCY;
    updates.fx_rate = fx_rate;
  } else if (payload.amount !== undefined || payload.currency !== undefined) {
    const { data: existing } = await supabase
      .from("trip_budget_items")
      .select("amount, currency")
      .eq("id", itemId)
      .single();
    if (existing) {
      const amount = payload.amount ?? (existing as { amount: number }).amount;
      const currency = payload.currency ?? (existing as { currency: string }).currency;
      const { amount_base, fx_rate } = toAmountBase(amount, currency);
      updates.amount = amount;
      updates.currency = currency;
      updates.amount_base = amount_base;
      updates.base_currency = BASE_CURRENCY;
      updates.fx_rate = fx_rate;
    }
  }

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from("trip_budget_items")
      .select()
      .eq("id", itemId)
      .single();
    if (error) throw new Error(error.message);
    return data as BudgetItemRow;
  }

  const { data, error } = await supabase
    .from("trip_budget_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as BudgetItemRow;
}

export async function deleteBudgetItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("trip_budget_items").delete().eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function createBudgetCategory(
  tripId: string,
  payload: CreateBudgetCategoryPayload
): Promise<{ id: string; trip_id: string; name: string; color: string; icon: string }> {
  const { data, error } = await supabase
    .from("trip_budget_categories")
    .insert({
      trip_id: tripId,
      name: payload.name,
      color: payload.color,
      icon: payload.icon,
    })
    .select("id, trip_id, name, color, icon")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as { id: string; trip_id: string; name: string; color: string; icon: string };
}

export async function deleteBudgetCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from("trip_budget_categories")
    .delete()
    .eq("id", categoryId);
  if (error) {
    throw new Error(error.message);
  }
}
