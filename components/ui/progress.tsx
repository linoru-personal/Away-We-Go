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
        className={`h-2 rounded-full overflow-hidden bg-neutral-200 ${trackClassName}`.trim()}
      >
        <div
          className={`h-2 rounded-full bg-orange-400 transition-all duration-300 ease-out ${fillClassName}`.trim()}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
