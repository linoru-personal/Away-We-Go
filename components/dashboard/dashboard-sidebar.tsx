"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Map,
  Luggage,
  Wallet,
  FileText,
  ImageIcon,
  CheckSquare,
  Home,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import type { DashboardTrip } from "./dashboard-trips-context";

const SIDEBAR_WIDTH = "w-[300px]";

function formatTripMonthLabel(start: string | null, end: string | null): string {
  const d = start || end;
  if (!d) return "Dates TBC";
  const date = new Date(d + "T12:00:00");
  if (Number.isNaN(date.getTime())) return "Dates TBC";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function tripLabel(t: DashboardTrip): string {
  const dest = t.destination?.trim();
  if (dest) return dest;
  return t.title?.trim() || "Trip";
}

type NavChild = {
  href: string;
  label: string;
  icon: ReactNode;
};

function tripChildLinks(tripId: string): NavChild[] {
  const iconClass = "size-4 shrink-0 text-[#6b7c8f]";
  return [
    {
      href: `/dashboard/trip/${tripId}`,
      label: "Trip Overview",
      icon: <LayoutGrid className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/places`,
      label: "Places",
      icon: <Map className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/packing`,
      label: "Packing",
      icon: <Luggage className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/budget`,
      label: "Budget",
      icon: <Wallet className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/notes`,
      label: "Notes",
      icon: <FileText className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/photos`,
      label: "Photos",
      icon: <ImageIcon className={iconClass} strokeWidth={1.75} />,
    },
    {
      href: `/dashboard/trip/${tripId}/tasks`,
      label: "Tasks",
      icon: <CheckSquare className={iconClass} strokeWidth={1.75} />,
    },
  ];
}

export function DashboardSidebar({
  trips,
  loadingTrips,
  coverThumbSignedUrls,
  destinationSignedUrls,
  onNavigate,
  embedded,
}: {
  trips: DashboardTrip[];
  loadingTrips: boolean;
  coverThumbSignedUrls: Record<string, string>;
  destinationSignedUrls: Record<string, string>;
  /** Close mobile drawer after navigation */
  onNavigate?: () => void;
  /** Inside mobile drawer: drop outer border (drawer provides edge) */
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const upcoming = useMemo(
    () =>
      trips.filter((t) => t.end_date == null || t.end_date >= today),
    [trips, today]
  );
  const past = useMemo(
    () => trips.filter((t) => t.end_date != null && t.end_date < today),
    [trips, today]
  );

  const activeTripIdFromPath = useMemo(() => {
    const m = pathname?.match(/^\/dashboard\/trip\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTripIdFromPath) {
      setExpandedIds((prev) => new Set(prev).add(activeTripIdFromPath));
    }
  }, [activeTripIdFromPath]);

  const toggleTrip = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isHome = pathname === "/dashboard";

  const renderTripGroup = (label: string, list: DashboardTrip[]) => (
    <div className="mt-6">
      <p className="px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#b8957a]">
        {label}
      </p>
      <ul className="mt-2 space-y-0.5">
        {list.map((t) => {
          const thumb =
            coverThumbSignedUrls[t.id] ||
            destinationSignedUrls[t.id] ||
            t.cover_image_url ||
            null;
          const expanded = expandedIds.has(t.id);
          const onTripPath = activeTripIdFromPath === t.id;

          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => toggleTrip(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[#f8f4f0] ${
                  onTripPath && !isHome ? "bg-[#faf6f3]" : ""
                }`}
                aria-expanded={expanded}
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[#ebe5df]">
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex size-full items-center justify-center text-[10px] font-medium text-[#9a8f86]"
                      aria-hidden
                    >
                      Trip
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#2d2d2d]">
                    {tripLabel(t)}
                  </p>
                  <p className="text-xs text-[#a0806a]">
                    {formatTripMonthLabel(t.start_date, t.end_date)}
                  </p>
                </div>
                {expanded ? (
                  <ChevronUp className="size-4 shrink-0 text-[#8a8a8a]" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-[#8a8a8a]" />
                )}
              </button>
              {expanded && (
                <div className="relative mt-1 ml-[1.375rem] border-l border-[#e5ddd6] pl-3 pb-1">
                  <ul className="space-y-0.5">
                    {tripChildLinks(t.id).map((item) => {
                      const active = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => onNavigate?.()}
                            className={`flex items-center gap-2.5 rounded-lg py-2 pr-2 text-sm transition ${
                              active
                                ? "font-medium text-[#c45c3e]"
                                : "text-[#5c6b7a] hover:text-[#2d3d4d]"
                            }`}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!loadingTrips && list.length === 0 && (
        <p className="mt-2 px-3 text-xs text-[#a8a8a8]">No trips</p>
      )}
    </div>
  );

  return (
    <aside
      className={`${SIDEBAR_WIDTH} sticky top-0 h-screen shrink-0 bg-white ${
        embedded ? "" : "border-r border-[#ebe5df]"
      }`}
    >
      <div className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-6">
        <Link
          href="/dashboard"
          onClick={() => onNavigate?.()}
          className="block bg-transparent px-1 outline-none focus-visible:ring-2 focus-visible:ring-[#d97b5e] focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="sr-only">Away We Go — home</span>
          <AppLogo variant="sidebar" className="max-w-full bg-transparent" />
          <p className="mt-2 text-sm text-[#9b7b6b]">Plan your adventures</p>
        </Link>
        <div className="my-5 h-px bg-[#ebe5df]" />

        <Link
          href="/dashboard"
          onClick={() => onNavigate?.()}
          className={`flex items-center gap-2.5 rounded-full px-4 py-3 text-sm font-medium transition ${
            isHome
              ? "bg-[#fdece5] text-[#c45c3e] shadow-sm"
              : "text-[#5c4a42] hover:bg-[#faf6f3]"
          }`}
        >
          <Home
            className={`size-5 shrink-0 ${isHome ? "text-[#d97b5e]" : "text-[#8a7568]"}`}
            strokeWidth={1.75}
          />
          Home
        </Link>

        {loadingTrips ? (
          <p className="mt-6 px-3 text-sm text-[#8a8a8a]">Loading trips…</p>
        ) : (
          <>
            {renderTripGroup("Upcoming", upcoming)}
            {renderTripGroup("Past", past)}
          </>
        )}
      </div>
    </aside>
  );
}
