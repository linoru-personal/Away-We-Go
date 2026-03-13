'use client';

import { supabase } from "@/app/lib/supabaseClient";

/** Budget feature is EXPENSES ONLY. All items are stored in trip_budget_items; totals use amount_base. No "planned" tables/fields. */
const BASE_CURRENCY = "USD";
/** Fallback rates to USD only when live API fails (ILS, EUR). Used only on 502/network error. */
const STATIC_FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  ILS: 0.27,
  EUR: 1.09,
};

const DEFAULT_TRIP_CURRENCIES = ["ILS", "USD", "EUR"];

/** Fetches live rate from our FX API. Returns rate or error info. Exported for Add Currency flow. */
export async function fetchLiveRateToUSD(
  currency: string
): Promise<{ rate: number } | { error: string; status: number }> {
  const from = currency.trim().toUpperCase();
  if (from === "USD") return { rate: 1 };
  try {
    const res = await fetch(
      `/api/fx?from=${encodeURIComponent(from)}&to=USD`
    );
    const data = (await res.json()) as { rate?: number; error?: string };
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : res.statusText || "Request failed";
      return { error: msg, status: res.status };
    }
    const rate = data?.rate;
    if (typeof rate !== "number" || rate <= 0) {
      return { error: "Invalid rate from exchange rate service", status: 502 };
    }
    return { rate };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Exchange rate service unavailable";
    return { error: msg, status: 502 };
  }
}

/**
 * Resolve rate to USD at save time: live FX from /api/fx, with static fallback only on provider failure.
 * - USD -> 1.
 * - 422 (unsupported currency) -> throws user-friendly message.
 * - 502/network -> uses STATIC_FALLBACK for ILS/EUR only; otherwise throws.
 */
async function getRateToUSD(_tripId: string, currency: string): Promise<number> {
  const upper = currency.toUpperCase();
  if (upper === "USD") return 1;

  const result = await fetchLiveRateToUSD(currency);
  if ("rate" in result) return result.rate;

  if (result.status === 422) {
    throw new Error(
      result.error || "This currency is not supported by the exchange rate service. Add a manual rate in trip settings (Add currency) if needed."
    );
  }

  const fallback = STATIC_FALLBACK_RATES_TO_USD[upper];
  if (fallback != null) return fallback;

  throw new Error(
    "Exchange rate unavailable. Please try again or add a manual rate in trip settings (Add currency)."
  );
}

export async function fetchTripCurrencies(tripId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("trip_currencies")
    .select("currency")
    .eq("trip_id", tripId)
    .order("currency", { ascending: true });
  if (error) throw new Error(error.message);
  const list = (data ?? []).map((r: { currency: string }) => r.currency);
  return list.length > 0 ? list : [...DEFAULT_TRIP_CURRENCIES];
}

export async function addTripCurrency(tripId: string, currency: string): Promise<void> {
  const row = {
    trip_id: tripId,
    currency: currency.trim().toUpperCase(),
  };
  const { error } = await supabase.from("trip_currencies").upsert(row, {
    onConflict: "trip_id,currency",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
}

/** Removes a currency from the trip. Does not allow removing defaults (ILS, USD, EUR). */
export async function removeTripCurrency(tripId: string, currency: string): Promise<void> {
  const upper = currency.trim().toUpperCase();
  if (DEFAULT_TRIP_CURRENCIES.includes(upper)) {
    throw new Error(`Cannot remove default currency ${currency}.`);
  }
  const { error } = await supabase
    .from("trip_currencies")
    .delete()
    .eq("trip_id", tripId)
    .eq("currency", upper);
  if (error) throw new Error(error.message);
}

/** Returns map from from_currency to rate (to USD). Assumes to_currency = USD. */
export async function fetchTripExchangeRates(
  tripId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("trip_exchange_rates")
    .select("from_currency, rate")
    .eq("trip_id", tripId)
    .eq("to_currency", "USD");
  if (error) throw new Error(error.message);
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const r = row as { from_currency: string; rate: number };
    map[r.from_currency.toUpperCase()] = Number(r.rate);
  }
  return map;
}

export async function upsertTripExchangeRate(
  tripId: string,
  fromCurrency: string,
  rateToUSD: number
): Promise<void> {
  const from = fromCurrency.trim().toUpperCase();
  const { error } = await supabase.from("trip_exchange_rates").upsert(
    {
      trip_id: tripId,
      from_currency: from,
      to_currency: "USD",
      rate: rateToUSD,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trip_id,from_currency,to_currency" }
  );
  if (error) throw new Error(error.message);
}

function toAmountBaseSync(
  amount: number,
  rateToUSD: number
): { amount_base: number; fx_rate: number } {
  return { amount_base: amount * rateToUSD, fx_rate: rateToUSD };
}

export type BudgetCategorySummary = {
  id: string;
  name: string;
  color: string;
  icon: string;
  total_base: number;
  sort_order: number;
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
  sort_order: number;
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
  color?: string;
  icon: string;
};

export type UpdateBudgetCategoryPayload = {
  name?: string;
  icon?: string;
};

export async function fetchBudgetData(tripId: string): Promise<BudgetData> {
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase
      .from("trip_budget_categories")
      .select("id, name, color, icon, sort_order")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("trip_budget_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
  ]);

  if (categoriesRes.error) {
    throw new Error(categoriesRes.error.message);
  }
  if (itemsRes.error) {
    throw new Error(itemsRes.error.message);
  }

  const categories = (categoriesRes.data ?? []) as (BudgetCategorySummary & { total_base?: number })[];
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
    sort_order: c.sort_order ?? 0,
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

/** Inserts one expense item into trip_budget_items only. No planned tables. */
export async function createBudgetItem(
  tripId: string,
  payload: CreateBudgetItemPayload
): Promise<BudgetItemRow> {
  const rateToUSD = await getRateToUSD(tripId, payload.currency);
  const { amount_base, fx_rate } = toAmountBaseSync(payload.amount, rateToUSD);

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
  tripId: string,
  itemId: string,
  payload: UpdateBudgetItemPayload
): Promise<BudgetItemRow> {
  const updates: Record<string, unknown> = {};

  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.categoryId !== undefined) updates.category_id = payload.categoryId ?? null;
  if (payload.date !== undefined) updates.date = payload.date ?? null;
  if (payload.notes !== undefined) updates.notes = payload.notes ?? null;

  if (payload.amount !== undefined && payload.currency !== undefined) {
    const rateToUSD = await getRateToUSD(tripId, payload.currency);
    const { amount_base, fx_rate } = toAmountBaseSync(payload.amount, rateToUSD);
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
      const rateToUSD = await getRateToUSD(tripId, currency);
      const { amount_base, fx_rate } = toAmountBaseSync(amount, rateToUSD);
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

const DEFAULT_CATEGORY_COLOR = "#E07A5F";

export async function createBudgetCategory(
  tripId: string,
  payload: CreateBudgetCategoryPayload
): Promise<{ id: string; trip_id: string; name: string; color: string; icon: string; sort_order: number }> {
  const { data, error } = await supabase
    .from("trip_budget_categories")
    .insert({
      trip_id: tripId,
      name: payload.name,
      color: payload.color ?? DEFAULT_CATEGORY_COLOR,
      icon: payload.icon,
    })
    .select("id, trip_id, name, color, icon, sort_order")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as { id: string; trip_id: string; name: string; color: string; icon: string; sort_order: number };
}

export async function updateBudgetCategory(
  tripId: string,
  categoryId: string,
  payload: UpdateBudgetCategoryPayload
): Promise<{ id: string; trip_id: string; name: string; color: string; icon: string; sort_order: number }> {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.icon !== undefined) updates.icon = payload.icon;
  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from("trip_budget_categories")
      .select("id, trip_id, name, color, icon, sort_order")
      .eq("id", categoryId)
      .eq("trip_id", tripId)
      .single();
    if (error) throw new Error(error.message);
    return data as { id: string; trip_id: string; name: string; color: string; icon: string; sort_order: number };
  }
  const { data, error } = await supabase
    .from("trip_budget_categories")
    .update(updates)
    .eq("id", categoryId)
    .eq("trip_id", tripId)
    .select("id, trip_id, name, color, icon, sort_order")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data as { id: string; trip_id: string; name: string; color: string; icon: string; sort_order: number };
}

/** Move all items in this category to General (uncategorized), then delete the category. */
export async function deleteBudgetCategory(categoryId: string): Promise<void> {
  const { error: updateError } = await supabase
    .from("trip_budget_items")
    .update({ category_id: null })
    .eq("category_id", categoryId);
  if (updateError) {
    throw new Error(updateError.message);
  }
  const { error: deleteError } = await supabase
    .from("trip_budget_categories")
    .delete()
    .eq("id", categoryId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
