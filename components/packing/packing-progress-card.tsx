"use client";

export function PackingProgressCard({ packed, total }: { packed: number; total: number }) {
  if (total === 0) {
    return (
      <div className="rounded-[22px] bg-[#E07A5F] px-5 py-5 text-[#2B1610] shadow-[0_6px_16px_rgba(224,122,95,0.25)]">
        <p className="font-bold">Nothing packed yet. Add your first item.</p>
      </div>
    );
  }
  const pct = Math.round((packed / total) * 100);
  return (
    <div className="flex items-center gap-4 rounded-[22px] bg-[#E07A5F] px-5 py-5 text-[#2B1610] shadow-[0_6px_16px_rgba(224,122,95,0.25)]">
      <div
        className="flex size-[76px] shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#FFFFFF ${pct}%, rgba(255,255,255,0.35) 0)` }}
        role="img"
        aria-label={`${pct}% packed`}
      >
        <div className="flex size-[58px] items-center justify-center rounded-full bg-[#E07A5F] text-lg font-extrabold tabular-nums">
          {pct}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold">{total - packed} left to pack</p>
        <p className="mt-0.5 text-sm font-medium opacity-80">
          {packed} of {total} packed
        </p>
      </div>
    </div>
  );
}
