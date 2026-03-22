"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useSession } from "@/app/lib/useSession";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-[#6b6b6b]">
        Loading...
      </p>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
