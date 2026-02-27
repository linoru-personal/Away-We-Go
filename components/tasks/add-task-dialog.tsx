"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeOptions: string[];
  onAdd: (params: {
    title: string;
    assignee: string;
    description: string | null;
  }) => Promise<void>;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  assigneeOptions,
  onAdd,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("Everyone");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await onAdd({
        title: trimmedTitle,
        assignee: assignee.trim() || "Everyone",
        description: description.trim() || null,
      });
      setTitle("");
      setAssignee("Everyone");
      setDescription("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add task.");
    } finally {
      setAdding(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle("");
      setAssignee("Everyone");
      setDescription("");
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#4A4A4A]">Add Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">
              Title (required)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
              disabled={adding}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">
              Assignee
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A]"
              disabled={adding}
            >
              {assigneeOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details or a shopping list…"
              className="w-full rounded-lg border border-[#D4C5BA] bg-white px-3 py-2 text-sm text-[#4A4A4A] placeholder:text-[#6B7280]"
              disabled={adding}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-[#D4C5BA] px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0]"
              onClick={() => handleOpenChange(false)}
              disabled={adding}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-50"
              onClick={handleSubmit}
              disabled={adding}
            >
              {adding ? "Adding…" : "Add Task"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
