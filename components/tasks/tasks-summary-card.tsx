"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

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

const CARD_CLASS =
  "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

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
    <article className={CARD_CLASS}>
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
        onClick={() => router.push(`/dashboard/trip/${tripId}/tasks`)}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[#4A4A4A]">Tasks</h2>
          <p className="mt-0.5 text-sm text-[#9B7B6B]">
            {loading ? "…" : `${completed} of ${total} completed`}
          </p>
        </div>
        {!loading && (
          <span className="text-2xl font-semibold text-[#E07A5F]">
            {openCount}
          </span>
        )}
      </button>

      {loading ? (
        <p className="mt-4 text-sm text-[#6B7280]">Loading…</p>
      ) : (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F5F3F0]">
            <div
              className="h-full rounded-full bg-[#E07A5F] transition-all duration-500"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          {displayTasks.length > 0 ? (
            <ul className="mt-4 space-y-3">
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
                    <p className="text-xs text-[#9B7B6B]">
                      {t.assignee || "Unassigned"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#6B7280]">No tasks yet.</p>
          )}

          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-medium text-[#E07A5F] transition hover:text-[#c46950]"
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
