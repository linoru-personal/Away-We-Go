"use client";

import { Card } from "@/components/ui/card";

export interface CreateTripCardProps {
  onClick?: () => void;
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function CreateTripCard({ onClick }: CreateTripCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-neutral-300 py-10 transition-colors hover:border-neutral-400"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        <PlusIcon />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">Create a new trip</div>
        <div className="text-sm text-neutral-500">
          Plan, organize, and start your next adventure
        </div>
      </div>
    </Card>
  );
}
