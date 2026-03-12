"use client";

import { useEffect, useState } from "react";
import {
  fetchBudgetData,
  fetchTripCurrencies,
  fetchTripExchangeRates,
  deleteBudgetItem,
  type BudgetData,
  type BudgetCategorySummary,
  type BudgetItemRow,
} from "@/components/budget/budget-queries";
import {
  formatMoney,
  usdToDisplay,
  convertViaUSD,
  RATES_TO_USD,
  DEFAULT_CURRENCIES,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/components/budget/budget-money";
import { AddBudgetItemDialog } from "@/components/budget/add-budget-item-dialog";
import { AddCurrencyDialog } from "@/components/budget/add-currency-dialog";
import { ManageCategoriesDialog } from "@/components/budget/manage-categories-dialog";
import { CategoryIcon, BUDGET_DEFAULT_ICON, getIconKey, type CategoryIconKey } from "@/components/ui/category-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BUDGET_DISPLAY_CURRENCY_KEY = "budget_display_currency";

/** Display currency list: ILS, USD, EUR first, then trip-added currencies (unique). */
function mergeDisplayCurrencies(tripCurrencies: string[]): string[] {
  const out = [...DEFAULT_CURRENCIES];
  const defaultSet = new Set(DEFAULT_CURRENCIES.map((c) => c.toUpperCase()));
  for (const c of tripCurrencies) {
    const u = c.toUpperCase();
    if (!defaultSet.has(u)) out.push(u);
  }
  return out;
}

export interface BudgetPageProps {
  tripId: string;
  /** When false (e.g. viewer), hide add/edit/delete and manage categories. Default true. */
  canEditContent?: boolean;
}

function getStoredDisplayCurrency(tripId: string, displayCurrencies: string[]): string {
  if (typeof window === "undefined") return "ILS";
  const stored = window.localStorage.getItem(`${BUDGET_DISPLAY_CURRENCY_KEY}:${tripId}`);
  const upper = stored?.toUpperCase();
  if (upper && displayCurrencies.some((c) => c.toUpperCase() === upper)) return upper;
  return "ILS";
}

/** Merged rates: static RATES_TO_USD + trip-specific (trip overrides). */
function mergeRatesToUSD(
  tripRates: Record<string, number> | null
): Record<string, number> {
  return { ...RATES_TO_USD, ...(tripRates ?? {}) };
}

function setStoredDisplayCurrency(tripId: string, currency: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${BUDGET_DISPLAY_CURRENCY_KEY}:${tripId}`, currency);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/** Short label for day separator in date view (e.g. "Dec 19" or "Dec 29, 2025" if different year). */
function formatDayLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    const y = d.getFullYear();
    const sameYear = y === new Date().getFullYear();
    return sameYear
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

type DateGroup = {
  dateKey: string;
  dateLabel: string;
  iconKey: CategoryIconKey;
  items: BudgetItemRow[];
  total_base: number;
};

/** Group items by date (and "No date"), sorted by date; each group has label and total for section header. */
function itemsGroupedByDate(itemsGrouped: BudgetData["itemsGrouped"]): DateGroup[] {
  const flat: BudgetItemRow[] = [];
  for (const g of itemsGrouped) flat.push(...g.items);
  const byDate = new Map<string | null, BudgetItemRow[]>();
  for (const item of flat) {
    const key = item.date ?? null;
    const list = byDate.get(key) ?? [];
    list.push(item);
    byDate.set(key, list);
  }
  const withDate: DateGroup[] = Array.from(byDate.entries())
    .filter(([date]) => date != null)
    .sort(([a], [b]) => a!.localeCompare(b!))
    .map(([date, items]) => ({
      dateKey: date!,
      dateLabel: formatDayLabel(date!),
      iconKey: "calendar" as CategoryIconKey,
      items,
      total_base: items.reduce((s, i) => s + Number(i.amount_base), 0),
    }));
  const noDateItems = byDate.get(null) ?? [];
  if (noDateItems.length > 0) {
    withDate.push({
      dateKey: "__no_date__",
      dateLabel: "No date",
      iconKey: BUDGET_DEFAULT_ICON,
      items: noDateItems,
      total_base: noDateItems.reduce((s, i) => s + Number(i.amount_base), 0),
    });
  }
  return withDate;
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function BudgetPage({ tripId, canEditContent = true }: BudgetPageProps) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [tripCurrencies, setTripCurrencies] = useState<string[]>([]);
  const [ratesToUSDMap, setRatesToUSDMap] = useState<Record<string, number>>(RATES_TO_USD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItemRow | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("ILS");
  const [listView, setListView] = useState<"category" | "date">("category");

  const displayCurrencies = mergeDisplayCurrencies(tripCurrencies);

  useEffect(() => {
    if (!tripId) return;
    setDisplayCurrency((prev) => {
      const stored = getStoredDisplayCurrency(tripId, displayCurrencies);
      return displayCurrencies.length > 0 ? stored : prev;
    });
  }, [tripId, displayCurrencies]);

  const handleDisplayCurrencyChange = (value: string) => {
    if (value === "__add_currency__") {
      setAddCurrencyOpen(true);
      return;
    }
    setDisplayCurrency(value);
    setStoredDisplayCurrency(tripId, value);
  };

  const refetchBudget = () => {
    if (!tripId) return;
    fetchBudgetData(tripId).then(setData).catch(() => {});
    fetchTripExchangeRates(tripId).then((tripRates) =>
      setRatesToUSDMap(mergeRatesToUSD(tripRates))
    );
    fetchTripCurrencies(tripId).then(setTripCurrencies).catch(() => {});
  };

  const handleAddItemClose = (open: boolean) => {
    if (!open) setEditingItem(null);
    setAddItemOpen(open);
  };

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchBudgetData(tripId),
      fetchTripExchangeRates(tripId),
      fetchTripCurrencies(tripId),
    ])
      .then(([budgetData, tripRates, currencies]) => {
        setData(budgetData);
        setRatesToUSDMap(mergeRatesToUSD(tripRates));
        setTripCurrencies(currencies);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load budget"))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <p className="mt-8 text-[#6B7280]">Loading budget…</p>
    );
  }

  if (error) {
    return (
      <div className="mt-8 space-y-2">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const budget = data ?? {
    items_count: 0,
    categories_count: 0,
    total_base: 0,
    categories: [],
    itemsGrouped: [],
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Header: title + subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-[#4A4A4A]">Budget</h1>
        <p className="mt-0.5 text-sm text-[#9B7B6B]">Track your trip expenses</p>
      </div>

      {/* Total Budget card (large orange rounded) + Spending Breakdown */}
      <div className="rounded-[24px] bg-[#E07A5F] p-6 text-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-90">Total Budget</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {formatMoney(
                usdToDisplay(budget.total_base, displayCurrency, ratesToUSDMap),
                displayCurrency
              )}
            </p>
            <p className="mt-2 text-xs opacity-90">
              {budget.items_count} items • {budget.categories_count} categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={displayCurrency}
              onChange={(e) => handleDisplayCurrencyChange(e.target.value)}
              className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur-sm appearance-none cursor-pointer border-0 pr-8 focus:outline-none focus:ring-2 focus:ring-white/50"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.25rem center",
                backgroundSize: "1.25rem",
              }}
              aria-label="Display currency"
            >
              {displayCurrencies.map((c) => (
                <option key={c} value={c} className="text-[#1f1f1f]">
                  {c}
                </option>
              ))}
              {canEditContent && (
              <option value="__add_currency__" className="text-[#1f1f1f]">
                Add currency…
              </option>
              )}
            </select>
          </div>
        </div>

        {/* Spending Breakdown (only categories with expenses) */}
        {(() => {
          const withExpenses = budget.itemsGrouped.filter((group) => {
            const totalBase = group.category?.total_base ?? group.items.reduce((s, i) => s + Number(i.amount_base), 0);
            return totalBase > 0;
          });
          return withExpenses.length > 0 && budget.total_base > 0 ? (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider opacity-90">
                Spending Breakdown
              </p>
              <div className="-mx-6 overflow-x-auto px-6 pb-1">
                <div className="flex gap-3" style={{ minWidth: "min-content" }}>
                  {withExpenses.map((group) => {
                    const totalBase = group.category?.total_base ?? group.items.reduce((s, i) => s + Number(i.amount_base), 0);
                    const percent = Math.round((totalBase / budget.total_base) * 100);
                    const amountDisplay = formatMoney(
                      usdToDisplay(totalBase, displayCurrency, ratesToUSDMap),
                      displayCurrency
                    );
                    const label = group.category?.name ?? "General";
                    return (
                      <div
                        key={group.category?.id ?? "uncategorized"}
                        className="flex w-[140px] shrink-0 flex-col rounded-xl bg-white/20 p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center">
                            <CategoryIcon
                              iconKey={getIconKey(group.category?.icon, BUDGET_DEFAULT_ICON)}
                              size={20}
                              className="text-white"
                            />
                          </div>
                          <span className="text-lg font-bold">{percent}%</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium">{label}</p>
                        <p className="mt-1 text-sm font-medium opacity-95">{amountDisplay}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {withExpenses.length > 3 && (
                <p className="mt-2 text-center text-xs opacity-80">
                  ← Swipe to see all categories →
                </p>
              )}
            </div>
          ) : null;
        })()}
      </div>

      <div className="flex justify-end">
        {canEditContent && (
        <button
          type="button"
          className="rounded-full bg-[#E07A5F] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(224,122,95,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
          onClick={() => setAddItemOpen(true)}
        >
          Add Item
        </button>
        )}
      </div>

      {/* View toggle: same style as packing page (By Category / By Participant) */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            listView === "category"
              ? "border-[#E07A5F] bg-[#E07A5F] text-white"
              : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
          }`}
          onClick={() => setListView("category")}
        >
          By category
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            listView === "date"
              ? "border-[#E07A5F] bg-[#E07A5F] text-white"
              : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
          }`}
          onClick={() => setListView("date")}
        >
          By date
        </button>
      </div>

      {/* Manage Categories */}
      {canEditContent && (
      <div className="mt-2">
        <button
          type="button"
          className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
          onClick={() => setManageCategoriesOpen(true)}
        >
          Manage Categories
        </button>
      </div>
      )}

      {/* Category list with items (default) */}
      {listView === "category" && (
      <div className="space-y-8">
        {budget.itemsGrouped.map((group) => (
          <section key={group.category?.id ?? "uncategorized"}>
            {/* Category header: icon, name, total */}
            <div className="mb-3 flex items-center gap-3">
              {group.category ? (
                <>
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl text-[#1f1f1f]">
                    <CategoryIcon iconKey={getIconKey(group.category.icon)} size={22} />
                  </div>
                  <span className="flex-1 font-semibold text-[#4A4A4A]">
                    {group.category.name}
                  </span>
                  <span className="text-right font-medium text-[#4A4A4A]">
                    {formatMoney(
                      usdToDisplay(group.category.total_base, displayCurrency, ratesToUSDMap),
                      displayCurrency
                    )}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl text-[#1f1f1f]">
                    <CategoryIcon iconKey={BUDGET_DEFAULT_ICON} size={22} />
                  </div>
                  <span className="flex-1 font-semibold text-[#4A4A4A]">General</span>
                  <span className="text-right font-medium text-[#4A4A4A]">
                    {formatMoney(
                      usdToDisplay(
                        group.items.reduce((s, i) => s + Number(i.amount_base), 0),
                        displayCurrency,
                        ratesToUSDMap
                      ),
                      displayCurrency
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Item rows */}
            <div className="rounded-[24px] border border-[#ebe5df] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
              {group.items.length === 0 ? (
                <p className="py-2 text-sm text-[#6B7280]">No items</p>
              ) : (
                <ul className="divide-y divide-[#F5F3F0]" role="list">
                  {group.items.map((item) => (
                    <BudgetItemRow
                      key={item.id}
                      item={item}
                      displayCurrency={displayCurrency}
                      ratesToUSDMap={ratesToUSDMap}
                      canEdit={canEditContent}
                      onEdit={() => {
                        setEditingItem(item);
                        setAddItemOpen(true);
                      }}
                      onDelete={async () => {
                        await deleteBudgetItem(item.id);
                        refetchBudget();
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
      )}

      {/* Date view: sections like category view (date header + card per day) */}
      {listView === "date" && (() => {
        const groupsByDate = itemsGroupedByDate(budget.itemsGrouped);
        const categoryNameById = new Map(budget.categories.map((c) => [c.id, c.name]));
        if (groupsByDate.length === 0) {
          return (
            <div className="rounded-[24px] border border-[#ebe5df] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
              <p className="py-2 text-sm text-[#6B7280]">No items</p>
            </div>
          );
        }
        return (
          <div className="space-y-8">
            {groupsByDate.map((group) => (
              <section key={group.dateKey}>
                {/* Date header: icon, label, total (same layout as category) */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl text-[#1f1f1f]">
                    <CategoryIcon iconKey={getIconKey(group.iconKey, BUDGET_DEFAULT_ICON)} size={22} />
                  </div>
                  <span className="flex-1 font-semibold text-[#4A4A4A]">
                    {group.dateLabel}
                  </span>
                  <span className="text-right font-medium text-[#4A4A4A]">
                    {formatMoney(
                      usdToDisplay(group.total_base, displayCurrency, ratesToUSDMap),
                      displayCurrency
                    )}
                  </span>
                </div>
                {/* Item rows in same card as category view */}
                <div className="rounded-[24px] border border-[#ebe5df] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
                  <ul className="divide-y divide-[#F5F3F0]" role="list">
                    {group.items.map((item) => {
                      const categoryName = item.category_id
                        ? categoryNameById.get(item.category_id) ?? null
                        : null;
                      return (
                        <BudgetItemRow
                          key={item.id}
                          item={item}
                          displayCurrency={displayCurrency}
                          ratesToUSDMap={ratesToUSDMap}
                          canEdit={canEditContent}
                          showCategoryLabel={categoryName != null}
                          categoryLabel={categoryName ?? undefined}
                          hideDateInRow
                          onEdit={() => {
                            setEditingItem(item);
                            setAddItemOpen(true);
                          }}
                          onDelete={async () => {
                            await deleteBudgetItem(item.id);
                            refetchBudget();
                          }}
                        />
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        );
      })()}

      <AddBudgetItemDialog
        open={addItemOpen}
        onOpenChange={handleAddItemClose}
        tripId={tripId}
        categories={budget.categories}
        existingItem={editingItem}
        defaultCurrency={displayCurrency}
        tripCurrencies={displayCurrencies}
        onSuccess={refetchBudget}
        onCategoryCreated={(category) => {
          setData((prev) =>
            prev
              ? { ...prev, categories: [...prev.categories, category] }
              : prev
          );
        }}
      />

      <AddCurrencyDialog
        open={addCurrencyOpen}
        onOpenChange={setAddCurrencyOpen}
        tripId={tripId}
        existingCurrencies={displayCurrencies}
        onSuccess={refetchBudget}
      />

      <ManageCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        tripId={tripId}
        categories={budget.categories}
        onSuccess={setData}
      />
    </div>
  );
}

function BudgetItemRow({
  item,
  displayCurrency,
  ratesToUSDMap,
  canEdit,
  onEdit,
  onDelete,
  showCategoryLabel,
  categoryLabel,
  hideDateInRow,
  as: Wrapper = "li",
}: {
  item: BudgetItemRow;
  displayCurrency: string;
  ratesToUSDMap: Record<string, number>;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  showCategoryLabel?: boolean;
  categoryLabel?: string;
  /** When true (e.g. in "by date" view), do not show date in the row subtitle; section header is enough. */
  hideDateInRow?: boolean;
  as?: "li" | "div";
}) {
  const itemCurrency = item.currency.toUpperCase();
  const amountDisplay = formatMoney(item.amount, item.currency);
  const rateFrom = ratesToUSDMap[itemCurrency];
  const rateTo = ratesToUSDMap[displayCurrency];
  const showConverted =
    itemCurrency !== displayCurrency &&
    rateFrom != null &&
    rateTo != null &&
    rateFrom > 0 &&
    rateTo > 0;
  const convertedAmount = showConverted
    ? convertViaUSD(item.amount, item.currency, displayCurrency, ratesToUSDMap)
    : 0;
  const dateStr = hideDateInRow ? null : formatDate(item.date);

  return (
    <Wrapper className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#4A4A4A]">{item.name}</p>
        {(showCategoryLabel && categoryLabel) || dateStr ? (
          <p className="mt-0.5 text-xs text-[#6B7280]">
            {[showCategoryLabel && categoryLabel ? categoryLabel : null, dateStr]
              .filter(Boolean)
              .join(" · ") || null}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-medium text-[#4A4A4A]">{amountDisplay}</p>
          {showConverted && (
            <p className="text-xs text-[#6B7280]">
              ≈ {formatMoney(convertedAmount, displayCurrency)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
          <>
          <button
            type="button"
            className="rounded p-1.5 text-[#6B7280] transition hover:bg-[#F5F3F0] hover:text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
            aria-label="Edit item"
            onClick={onEdit}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-[#6B7280] transition hover:bg-[#F5F3F0] hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[#E07A5F] focus:ring-offset-2"
            aria-label="Delete item"
            onClick={() => onDelete()}
          >
            <TrashIcon />
          </button>
          </>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
