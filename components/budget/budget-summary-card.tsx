"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBudgetData } from "@/components/budget/budget-queries";
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_CARD_LINK_CLASS,
  DASHBOARD_CARD_CHEVRON_CLASS,
  DASHBOARD_CARD_CHEVRON_ICON_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
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

export function BudgetSummaryCard({ tripId }: BudgetSummaryCardProps) {
  const [totalBase, setTotalBase] = useState<number | null>(null);
  const [itemsCount, setItemsCount] = useState(0);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    fetchBudgetData(tripId)
      .then((data) => {
        setTotalBase(data.total_base);
        setItemsCount(data.items_count);
        setCategoriesCount(data.categories_count);
      })
      .catch(() => {
        setTotalBase(0);
        setItemsCount(0);
        setCategoriesCount(0);
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  return (
    <Link
      href={`/dashboard/trip/${tripId}/budget`}
      className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_LINK_CLASS}`}
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE_CLASS}>Budget</h2>
          <p className={META_CLASS}>
            {loading ? "…" : `${itemsCount} items • ${categoriesCount} categories`}
          </p>
        </div>
        {!loading && totalBase !== null && (
          <span className="text-xl font-semibold tabular-nums text-[#2d2d2d]">
            {formatUsd(totalBase)}
          </span>
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
