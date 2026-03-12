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

/** Same style as "By Category" / "By Participant" toggles: rectangular with rounded corners, selected = coral, unselected = white + border. */
export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
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
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? "border-[#E07A5F] bg-[#E07A5F] text-white"
                : "border-[#D4C5BA] bg-white text-[#4A4A4A] hover:bg-[#F5F3F0]"
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
