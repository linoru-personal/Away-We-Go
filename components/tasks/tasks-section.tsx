"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";

export type TaskStatus = "todo" | "done";

export type Task = {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string;
  created_at: string;
  sort_order: number;
};

export interface TasksSectionProps {
  tripId: string;
  /** When false (e.g. viewer), hide add/edit/delete/toggle. Default true. */
  canEditContent?: boolean;
  /** Avatar URL per participant, same order as participants. Optional; when missing, initials are shown in assignee pills. */
  participantAvatarUrls?: (string | null)[];
}


const DESCRIPTION_PREVIEW_LENGTH = 60;

function truncateDescription(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
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

function PencilIcon() {
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const CARD_CLASS = "bg-white rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";
const TASK_CARD_CLASS = "bg-white rounded-[24px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)]";

const EVERYONE_LABEL = "Everyone";

/** True if the string starts with a strong RTL character (e.g. Hebrew, Arabic). */
function isRtlText(s: string): boolean {
  if (!s || !s.trim()) return false;
  const code = (s.trim()[0] ?? "").codePointAt(0) ?? 0;
  return (
    (code >= 0x0590 && code <= 0x05ff) ||
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0xfb1d && code <= 0xfdfd) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

type TripParticipant = { id: string; name: string };

export function TasksSection({ tripId, canEditContent = true, participantAvatarUrls = [] }: TasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [completedSectionCollapsed, setCompletedSectionCollapsed] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  const [toggleErrorTaskId, setToggleErrorTaskId] = useState<string | null>(null);
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      setTasks((data ?? []) as Task[]);
      setLoading(false);
    };

    load();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setParticipants([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("id, name")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setParticipants([]);
          return;
        }
        setParticipants((data ?? []) as TripParticipant[]);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const assigneeOptions = useMemo(() => {
    const names = participants.map((p) => p.name);
    const base = [EVERYONE_LABEL, ...names];
    if (editingTaskId && editAssignee && !base.includes(editAssignee))
      return [editAssignee, ...base];
    return base;
  }, [participants, editingTaskId, editAssignee]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (assigneeFilter !== "all") {
      list = list.filter((t) => {
        const a = t.assignee?.trim() || "";
        const label = !a || a === "Unassigned" || a === EVERYONE_LABEL ? EVERYONE_LABEL : a;
        return label === assigneeFilter;
      });
    }
    return list;
  }, [tasks, assigneeFilter]);

  /** Sticky direction when RTL/LTR count is equal; avoid flipping on tie. */
  const [lastDirection, setLastDirection] = useState<"rtl" | "ltr">("ltr");
  /** When true, (filtered) tasks are shown RTL; majority wins, on tie keep current. */
  const listRtl = useMemo(() => {
    if (filteredTasks.length === 0) return false;
    const rtlCount = filteredTasks.filter((t) => isRtlText(t.title)).length;
    const total = filteredTasks.length;
    const half = total / 2;
    if (rtlCount > half) return true;
    if (rtlCount < half) return false;
    return lastDirection === "rtl";
  }, [filteredTasks, lastDirection]);
  useEffect(() => {
    if (filteredTasks.length === 0) return;
    const rtlCount = filteredTasks.filter((t) => isRtlText(t.title)).length;
    const total = filteredTasks.length;
    const half = total / 2;
    if (rtlCount > half) setLastDirection("rtl");
    else if (rtlCount < half) setLastDirection("ltr");
  }, [filteredTasks]);

  const todoTasks = useMemo(() => {
    const todo = filteredTasks.filter((t) => t.status === "todo");
    todo.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return todo;
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    const done = filteredTasks.filter((t) => t.status === "done");
    done.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return done;
  }, [filteredTasks]);

  const totalTaskCount = tasks.length;
  const completedCountAll = tasks.filter((t) => t.status === "done").length;
  const progressValue =
    totalTaskCount > 0
      ? Math.round((completedCountAll / totalTaskCount) * 100)
      : 0;
  const hasFilters = assigneeFilter !== "all";
  const emptyStateMessage = useMemo(() => {
    if (tasks.length === 0) return "No tasks yet. Add your first one.";
    if (filteredTasks.length === 0 && hasFilters) return "No tasks match this filter.";
    return null;
  }, [tasks.length, filteredTasks.length, hasFilters]);

  async function handleAddTask(params: {
    title: string;
    assignee: string;
    description: string | null;
  }) {
    const assigneeVal =
      params.assignee === EVERYONE_LABEL || !params.assignee?.trim()
        ? ""
        : params.assignee.trim();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        trip_id: tripId,
        title: params.title,
        assignee: assigneeVal,
        description: params.description,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    setTasks((prev) => [...prev, data as Task]);
  }

  function handleToggleDone(taskId: string) {
    setToggleErrorTaskId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: task.status } : t
            )
          );
          setToggleErrorTaskId(taskId);
        }
      });
  }

  function startEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    const a = task.assignee?.trim() || "";
    setEditAssignee(!a || a === "Unassigned" || a === EVERYONE_LABEL ? EVERYONE_LABEL : a);
    setEditDescription(task.description ?? "");
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditAssignee("");
    setEditDescription("");
  }

  async function saveEditTask() {
    if (editingTaskId == null) return;
    const taskId = editingTaskId;
    const titleVal = editTitle.trim();
    if (!titleVal) return;

    setEditSaving(true);
    const assigneeVal =
      editAssignee.trim() === EVERYONE_LABEL || !editAssignee.trim()
        ? ""
        : editAssignee.trim();
    const descriptionVal = editDescription.trim() || null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              title: titleVal,
              assignee: assigneeVal,
              description: descriptionVal,
            }
          : t
      )
    );
    setEditingTaskId(null);
    setEditTitle("");
    setEditAssignee("");
    setEditDescription("");

    const { error } = await supabase
      .from("tasks")
      .update({
        title: titleVal,
        assignee: assigneeVal,
        description: descriptionVal,
      })
      .eq("id", taskId);

    setEditSaving(false);
    if (error) console.error(error);
    else {
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 1500);
    }
  }

  function handleDelete(taskId: string) {
    const ok = typeof window !== "undefined" && window.confirm("Delete this task?");
    if (!ok) return;

    supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.error(error);
        else setTasks((prev) => prev.filter((t) => t.id !== taskId));
      });
  }

  function renderTaskCard(task: Task) {
    const isEditing = editingTaskId === task.id;
    const descriptionExpanded = expandedDescriptionId === task.id;
    const hasDescription = task.description && task.description.trim() !== "";

    if (isEditing) {
      return (
        <div className={`${TASK_CARD_CLASS} ${listRtl ? "text-right" : ""}`} dir={listRtl ? "rtl" : undefined}>
          <div className="space-y-3">
            <input
              type="text"
              className="w-full rounded-lg border border-[#D4C5BA] bg-[#F5F3F0] px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              disabled={editSaving}
            />
            <select
              className="w-full rounded-lg border border-[#D4C5BA] bg-[#F5F3F0] px-3 py-2 text-sm text-[#4A4A4A]"
              value={editAssignee}
              onChange={(e) => setEditAssignee(e.target.value)}
              disabled={editSaving}
            >
              {assigneeOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded-lg border border-[#D4C5BA] bg-[#F5F3F0] px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add details…"
              disabled={editSaving}
              rows={3}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]"
                onClick={cancelEditTask}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-50"
                onClick={saveEditTask}
                disabled={editSaving || !editTitle.trim()}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${TASK_CARD_CLASS} ${listRtl ? "text-right" : ""}`} dir={listRtl ? "rtl" : undefined}>
        <div className="flex items-start gap-3">
          {canEditContent ? (
            <button
              type="button"
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition [&_svg]:size-2.5"
              style={{
                borderColor: task.status === "done" ? "#E07A5F" : "#D4C5BA",
                backgroundColor: task.status === "done" ? "#E07A5F" : "transparent",
              }}
              onClick={() => handleToggleDone(task.id)}
              aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
            >
              {task.status === "done" && <CheckIcon />}
            </button>
          ) : (
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border-2 [&_svg]:size-2.5"
              style={{
                borderColor: task.status === "done" ? "#E07A5F" : "#D4C5BA",
                backgroundColor: task.status === "done" ? "#E07A5F" : "transparent",
              }}
              aria-hidden
            >
              {task.status === "done" && <CheckIcon />}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p
              className={
                task.status === "done"
                  ? "text-sm font-medium text-[#9B7B6B] line-through"
                  : "text-sm font-medium text-[#4A4A4A]"
              }
              dir={listRtl ? "rtl" : "ltr"}
            >
              {task.title}
            </p>
            <p className="text-xs text-[#9B7B6B]">
              {!task.assignee?.trim() || task.assignee === "Unassigned" || task.assignee === EVERYONE_LABEL
                ? EVERYONE_LABEL
                : task.assignee}
            </p>
            {hasDescription && (
              <div className="mt-2">
                {descriptionExpanded ? (
                  <>
                    <p className="whitespace-pre-line text-sm text-[#6B7280]" dir={listRtl ? "rtl" : "ltr"}>
                      {task.description}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-[#E07A5F] hover:text-[#c46950]"
                      onClick={() =>
                        setExpandedDescriptionId((id) =>
                          id === task.id ? null : task.id
                        )
                      }
                    >
                      Hide details
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#E07A5F] hover:text-[#c46950]"
                    onClick={() => setExpandedDescriptionId(task.id)}
                  >
                    Show details
                  </button>
                )}
              </div>
            )}
          </div>

          {canEditContent && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-[#9B7B6B] hover:bg-[#F5F3F0] hover:text-[#4A4A4A]"
              onClick={() => startEditTask(task)}
              aria-label="Edit task"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-[#9B7B6B] hover:bg-red-50 hover:text-[#E07A5F]"
              onClick={() => handleDelete(task.id)}
              aria-label="Delete task"
            >
              <TrashIcon />
            </button>
          </div>
          )}
        </div>

        {toggleErrorTaskId === task.id && (
          <p className="mt-2 text-sm text-red-600">
            Failed to update status. Try again.
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#4A4A4A]">Tasks</h2>
          <p className="mt-0.5 text-sm text-[#9B7B6B]">Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Section title + progress (above the main card) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#4A4A4A]">Tasks</h2>
        <p className="mt-0.5 text-sm text-[#9B7B6B]">
          {completedCountAll} of {totalTaskCount} completed
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F5F3F0]">
          <div
            className="h-full rounded-full bg-[#E07A5F] transition-all duration-500"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      {/* Participant filter + Add Task (no card background) */}
      <div className="mt-6 flex flex-col gap-4">
          {/* Assignee filter: pill chips (same as design – unselected = white + border, selected = coral) */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                assigneeFilter === "all"
                  ? "border-[#E07A5F] bg-[#E07A5F] text-white"
                  : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
              }`}
              onClick={() => setAssigneeFilter("all")}
            >
              <span>All Tasks</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                assigneeFilter === EVERYONE_LABEL
                  ? "border-[#E07A5F] bg-[#E07A5F] text-white"
                  : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
              }`}
              onClick={() => setAssigneeFilter(EVERYONE_LABEL)}
            >
              <span>Everyone</span>
            </button>
            {participants.map((p, i) => {
              const avatarUrl = participantAvatarUrls[i] ?? null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                    assigneeFilter === p.name
                      ? "border-[#E07A5F] bg-[#E07A5F] text-white"
                      : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
                  }`}
                  onClick={() => setAssigneeFilter(p.name)}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="size-6 shrink-0 rounded-full object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E8E4E0] text-xs font-medium text-[#6B7280]"
                      aria-hidden
                    >
                      {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                  <span>{p.name}              </span>
                </button>
              );
            })}
          </div>

          {/* Add Task below participant filter (same layout as packing: button on right) */}
          {canEditContent && (
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F]"
                onClick={() => setAddModalOpen(true)}
              >
                Add Task
              </button>
            </div>
          )}
      </div>

      <AddTaskDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        assigneeOptions={assigneeOptions}
        onAdd={handleAddTask}
      />

      {editSaved && (
        <p className="mt-4 text-sm text-[#E07A5F]">Saved.</p>
      )}

      {/* Empty state when no tasks at all or no tasks match assignee filter */}
      {emptyStateMessage && (
        <div className="mt-6 rounded-xl border border-dashed border-[#D4C5BA] py-8 text-center text-sm text-[#6B7280]">
          {emptyStateMessage}
        </div>
      )}

      {/* Category-style sections: To do (always open), Completed (collapsible, open by default) */}
      {!emptyStateMessage && (
        <div className="mt-8 space-y-8">
          {/* To do – always visible */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-semibold text-[#4A4A4A]">To do</span>
              <span className="text-sm text-[#6B7280]">
                {todoTasks.length} task{todoTasks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className={`rounded-[24px] border border-[#ebe5df] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ${todoTasks.length === 0 ? "py-6" : ""}`}>
              {todoTasks.length === 0 ? (
                <p className="text-center text-sm text-[#6B7280]">No items</p>
              ) : (
                <ul className="space-y-3">
                  {todoTasks.map((t) => (
                    <li key={t.id}>{renderTaskCard(t)}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Completed – collapsible, open by default */}
          <section>
            <button
              type="button"
              className="mb-3 flex w-full items-center justify-between gap-2 text-left"
              onClick={() => setCompletedSectionCollapsed((c) => !c)}
            >
              <span className="font-semibold text-[#4A4A4A]">Completed</span>
              <span className="flex items-center gap-2 text-sm text-[#6B7280]">
                {completedTasks.length} task{completedTasks.length !== 1 ? "s" : ""}
                <ChevronDownIcon
                  className={`size-4 text-[#6B7280] transition ${completedSectionCollapsed ? "" : "rotate-180"}`}
                />
              </span>
            </button>
            {!completedSectionCollapsed && (
              <div className={`rounded-[24px] border border-[#ebe5df] bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ${completedTasks.length === 0 ? "py-6" : ""}`}>
                {completedTasks.length === 0 ? (
                  <p className="text-center text-sm text-[#6B7280]">No items</p>
                ) : (
                  <ul className="space-y-3">
                    {completedTasks.map((t) => (
                      <li key={t.id}>{renderTaskCard(t)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
