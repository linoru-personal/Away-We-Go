"use client";

import { useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Menu, X } from "lucide-react";
import { DashboardTripsProvider } from "./dashboard-trips-context";
import { DashboardSidebar } from "./dashboard-sidebar";
import { useDashboardTrips } from "./dashboard-trips-context";

function DashboardShellInner({ children }: { children: ReactNode }) {
  const {
    trips,
    loadingTrips,
    coverSignedUrls,
    destinationSignedUrls,
  } = useDashboardTrips();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f6f4]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <DashboardSidebar
          trips={trips}
          loadingTrips={loadingTrips}
          coverSignedUrls={coverSignedUrls}
          destinationSignedUrls={destinationSignedUrls}
        />
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/30 transition-opacity ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
        <div
          className={`absolute inset-y-0 left-0 z-50 w-[min(100%,320px)] max-w-full transform border-r border-[#ebe5df] bg-white shadow-xl transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex justify-end border-b border-[#ebe5df] p-2">
            <button
              type="button"
              className="rounded-lg p-2 text-[#5c4a42] hover:bg-[#f6f2ed]"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
          </div>
          <DashboardSidebar
            embedded
            trips={trips}
            loadingTrips={loadingTrips}
            coverSignedUrls={coverSignedUrls}
            destinationSignedUrls={destinationSignedUrls}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#ebe5df] bg-[#f8f6f4]/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[#2d2d2d] hover:bg-white/80"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-6" />
          </button>
          <span className="text-sm font-semibold text-[#2d2d2d]">Away We Go</span>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  return (
    <DashboardTripsProvider user={user}>
      <DashboardShellInner>{children}</DashboardShellInner>
    </DashboardTripsProvider>
  );
}
