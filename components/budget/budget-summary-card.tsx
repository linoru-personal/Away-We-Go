"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchBudgetData,
  type BudgetCategorySummary,
} from "@/components/budget/budget-queries";
import { CategoryIcon, getIconKey } from "@/components/ui/category-icons";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  DASHBOARD_CARD_CONTENT_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  NUMERIC_EMPHASIS_CLASS,
  CARD_CONTENT_MT,
} from "@/components/trip/dashboard-card-styles";

export interface BudgetSummaryCardProps {
  tripId: string;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function topSpendingCategories(
  categories: BudgetCategorySummary[],
  limit: number
): BudgetCategorySummary[] {
  return [...categories]
    .filter((c) => c.total_base > 0)
    .sort((a, b) => b.total_base - a.total_base)
    .slice(0, limit);
}

export function BudgetSummaryCard({ tripId }: BudgetSummaryCardProps) {
  const [totalBase, setTotalBase] = useState<number | null>(null);
  const [categories, setCategories] = useState<BudgetCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    fetchBudgetData(tripId)
      .then((data) => {
        setTotalBase(data.total_base);
        setCategories(data.categories);
      })
      .catch(() => {
        setTotalBase(0);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  const topCategories = topSpendingCategories(categories, 3);

  return (
    <Link
      href={`/dashboard/trip/${tripId}/budget`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS}`}
    >
      <div className={DASHBOARD_CARD_CONTENT_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Budget</h2>

        <p className={`${META_CLASS} text-[#6B7280]`}>Total Spent</p>
        <p className={`mt-0.5 ${NUMERIC_EMPHASIS_CLASS}`}>
          {loading ? "…" : formatUsd(totalBase ?? 0)}
        </p>

        {!loading && topCategories.length > 0 && (
          <>
            <p
              className={`${CARD_CONTENT_MT} text-xs font-medium uppercase tracking-wide text-[#8a8a8a]`}
            >
              Top Spending
            </p>
            <ul className={`${CARD_CONTENT_MT} space-y-2`}>
              {topCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[#8a8a8a]" aria-hidden>
                      <CategoryIcon iconKey={getIconKey(cat.icon)} size={18} />
                    </span>
                    <span className="truncate text-[#2d2d2d]">{cat.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[#2d2d2d]">
                    {formatUsd(cat.total_base)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <span className={DASHBOARD_CARD_CHEVRON_CLASS} aria-hidden>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={DASHBOARD_CARD_CHEVRON_ICON_CLASS}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
    </Link>
  );
}
