"use client";

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export default function SectionCard({
  title,
  subtitle,
  right,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-[24px] bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[#4A4A4A]">{title}</h2>
          {subtitle !== undefined && subtitle !== "" && (
            <p className="mt-0.5 text-sm text-[#9B7B6B]">{subtitle}</p>
          )}
        </div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-4">{children}</div>}
    </section>
  );
}
