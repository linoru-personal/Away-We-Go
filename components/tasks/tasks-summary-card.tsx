"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  DASHBOARD_CARD_CLASS,
  SECTION_TITLE_CLASS,
  META_CLASS,
  NUMERIC_EMPHASIS_CLASS,
  PROGRESS_TRACK_CLASS,
  PROGRESS_FILL_CLASS,
  EMPTY_STATE_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  CARD_CONTENT_MT,
  CARD_CTA_MT,
  CTA_LINK_CLASS,
} from "@/components/trip/dashboard-card-styles";

export type Task = {
  id: string;
  trip_id: string;
  title: string;
  status: "todo" | "done";
  assignee: string;
  created_at: string;
};

export interface TasksSummaryCardProps {
  tripId: string;
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2.5"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function TasksSummaryCard({ tripId }: TasksSummaryCardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("tasks")
      .select("id, trip_id, title, status, assignee, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setLoading(false);
          return;
        }
        setTasks((data ?? []) as Task[]);
        setLoading(false);
      });
  }, [tripId]);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const openCount = total - completed;
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0;
  const displayTasks = tasks.slice(0, 4);

  return (
    <article className={DASHBOARD_CARD_CLASS}>
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
        onClick={() => router.push(`/dashboard/trip/${tripId}/tasks`)}
      >
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE_CLASS}>Tasks</h2>
          <p className={META_CLASS}>
            {loading ? "…" : `${completed} of ${total} completed`}
          </p>
        </div>
        {!loading && (
          <span className={NUMERIC_EMPHASIS_CLASS}>{openCount}</span>
        )}
      </button>

      {loading ? (
        <p className={`${CARD_CONTENT_MT} text-sm text-[#8a8a8a]`}>Loading…</p>
      ) : (
        <>
          <div className={`${CARD_CONTENT_MT} ${PROGRESS_TRACK_CLASS}`}>
            <div
              className={PROGRESS_FILL_CLASS}
              style={{ width: `${progressValue}%` }}
            />
          </div>

          {displayTasks.length > 0 ? (
            <ul className={`${CARD_CONTENT_MT} space-y-3`}>
              {displayTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-2 transition ${
                      t.status === "done"
                        ? "border-[#E07A5F] bg-[#E07A5F]"
                        : "border-[#D4C5BA] bg-white"
                    }`}
                  >
                    {t.status === "done" && <CheckIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        t.status === "done"
                          ? "text-sm text-[#9B7B6B] line-through"
                          : "text-sm text-[#6B7280]"
                      }
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-[#8a8a8a]">
                      {!t.assignee?.trim() || t.assignee === "Unassigned"
                        ? "Everyone"
                        : t.assignee}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`${CARD_CONTENT_MT} ${EMPTY_STATE_CLASS}`}>
              <p className={EMPTY_STATE_TEXT_CLASS}>No tasks yet</p>
            </div>
          )}

          <div className={`${CARD_CTA_MT} text-center`}>
            <button
              type="button"
              className={CTA_LINK_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/trip/${tripId}/tasks`);
              }}
            >
              Manage Tasks →
            </button>
          </div>
        </>
      )}
    </article>
  );
}
