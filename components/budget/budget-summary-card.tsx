"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchBudgetData } from "@/components/budget/budget-queries";
import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  CARD_CTA_MT,
  CTA_LINK_CLASS,
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
  const router = useRouter();
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
    <article className={DASHBOARD_CARD_CLASS}>
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

      {!loading && (
        <div className={`${CARD_CTA_MT} text-center`}>
          <button
            type="button"
            className={CTA_LINK_CLASS}
            onClick={() => router.push(`/dashboard/trip/${tripId}/budget`)}
          >
            Manage Trip Budget →
          </button>
        </div>
      )}
    </article>
  );
}
