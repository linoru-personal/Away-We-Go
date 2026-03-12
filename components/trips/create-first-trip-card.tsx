"use client";

import { Card } from "@/components/ui/card";

const DEFAULT_SUBTITLE =
  "Start planning your next adventure with all the tools you need";

export interface CreateFirstTripCardProps {
  variant: "large" | "small";
  titleText: string;
  subtitle?: string;
  onClick?: () => void;
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-8"}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function CreateFirstTripCard({
  variant,
  titleText,
  subtitle = DEFAULT_SUBTITLE,
  onClick,
}: CreateFirstTripCardProps) {
  const isLarge = variant === "large";

  return (
    <Card
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer flex-col items-center justify-center transition-colors ${
        isLarge
          ? "min-h-[280px] gap-5 rounded-3xl border-2 border-dashed border-neutral-300 py-12 px-6 hover:border-neutral-400 hover:shadow-sm"
          : "min-h-[200px] gap-3 rounded-3xl border-2 border-dashed border-neutral-300 py-6 px-4 hover:border-neutral-400 hover:shadow-sm"
      }`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div
        className={`flex items-center justify-center rounded-full bg-orange-400 text-white ${
          isLarge ? "size-16" : "size-12"
        }`}
      >
        <PlusIcon className={isLarge ? "size-8" : "size-6"} />
      </div>
      <div className={`text-center ${isLarge ? "space-y-2" : "space-y-1"}`}>
        <h3
          className={
            isLarge
              ? "text-xl font-semibold text-neutral-900"
              : "text-lg font-semibold text-neutral-900"
          }
        >
          {titleText}
        </h3>
        {subtitle ? (
          <p
            className={
              isLarge
                ? "text-sm text-neutral-500 max-w-xs"
                : "text-xs text-neutral-500 max-w-[240px]"
            }
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
