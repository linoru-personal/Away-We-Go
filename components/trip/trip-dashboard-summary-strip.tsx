"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { fetchBudgetData } from "@/components/budget/budget-queries";
import {
  SUMMARY_STRIP_CLASS,
  SUMMARY_STRIP_STAT_CLASS,
  SUMMARY_STRIP_LABEL_CLASS,
} from "@/components/trip/dashboard-card-styles";

export interface TripDashboardSummaryStripProps {
  tripId: string;
}

type StripState = {
  tasksLeft: number;
  packingPacked: number;
  packingTotal: number;
  notesCount: number;
  budgetTotal: number;
  loading: boolean;
};

function formatBudgetCompact(usd: number): string {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(usd);
}

export function TripDashboardSummaryStrip({ tripId }: TripDashboardSummaryStripProps) {
  const [state, setState] = useState<StripState>({
    tasksLeft: 0,
    packingPacked: 0,
    packingTotal: 0,
    notesCount: 0,
    budgetTotal: 0,
    loading: true,
  });

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    Promise.all([
      supabase
        .from("tasks")
        .select("id, status")
        .eq("trip_id", tripId)
        .then(({ data }) => {
          const list = (data ?? []) as { id: string; status: string }[];
          const todo = list.filter((t) => t.status !== "done").length;
          return todo;
        }),
      supabase
        .from("packing_items")
        .select("id, is_packed")
        .eq("trip_id", tripId)
        .then(({ data }) => {
          const list = (data ?? []) as { id: string; is_packed: boolean }[];
          const packed = list.filter((i) => i.is_packed).length;
          return { packed, total: list.length };
        }),
      supabase
        .from("trip_notes")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .then(({ count }) => count ?? 0),
      fetchBudgetData(tripId).then((d) => d.total_base).catch(() => 0),
    ])
      .then(([tasksLeft, packing, notesCount, budgetTotal]) => {
        if (cancelled) return;
        setState({
          tasksLeft,
          packingPacked: packing.packed,
          packingTotal: packing.total,
          notesCount: notesCount ?? 0,
          budgetTotal,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (state.loading) {
    return (
      <div className={SUMMARY_STRIP_CLASS}>
        <span className={SUMMARY_STRIP_LABEL_CLASS}>…</span>
      </div>
    );
  }

  const packingLabel =
    state.packingTotal > 0
      ? `${state.packingPacked}/${state.packingTotal} packed`
      : "0 packed";

  return (
    <div className={SUMMARY_STRIP_CLASS} role="region" aria-label="Trip at a glance">
      <div className="flex items-baseline gap-1.5">
        <span className={SUMMARY_STRIP_STAT_CLASS}>{state.tasksLeft}</span>
        <span className={SUMMARY_STRIP_LABEL_CLASS}>tasks left</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={SUMMARY_STRIP_STAT_CLASS}>{packingLabel}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={SUMMARY_STRIP_STAT_CLASS}>{state.notesCount}</span>
        <span className={SUMMARY_STRIP_LABEL_CLASS}>notes</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={SUMMARY_STRIP_STAT_CLASS}>
          {formatBudgetCompact(state.budgetTotal)}
        </span>
        <span className={SUMMARY_STRIP_LABEL_CLASS}>budget</span>
      </div>
    </div>
  );
}
