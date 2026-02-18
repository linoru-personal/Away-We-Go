"use client";

export type TasksStatusFilter = "all" | "todo" | "done";

export interface SegmentedControlProps {
  value: TasksStatusFilter;
  onChange: (value: TasksStatusFilter) => void;
}

const OPTIONS: { value: TasksStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "done", label: "Done" },
];

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div
      className="inline-flex gap-1 rounded-full bg-[#F5F3F0] p-1"
      role="tablist"
      aria-label="Status filter"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-[#4A4A4A] shadow-sm"
                : "text-[#9B7B6B] hover:text-[#4A4A4A]"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
