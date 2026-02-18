export interface ProgressProps {
  value: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
}

export function Progress({
  value,
  className = "",
  trackClassName = "",
  fillClassName = "",
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={className.trim()}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-2 overflow-hidden rounded-full bg-[#F5F3F0] ${trackClassName}`.trim()}
      >
        <div
          className={`h-full rounded-full bg-[#E07A5F] transition-all duration-500 ${fillClassName}`.trim()}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
