"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/app/lib/useSession";
import { BudgetPage } from "@/components/budget/budget-page";

export default function TripBudgetPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  if (sessionLoading) {
    return (
      <p className="flex min-h-screen items-center justify-center p-6 text-[#6B7280]">
        Loading...
      </p>
    );
  }

  if (!user) return null;

  if (!id) {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        <BudgetPage tripId={id} />
      </div>
    </main>
  );
}
