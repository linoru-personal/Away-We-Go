import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Refresh sidebar trip list and leave a deleted / inaccessible trip route. */
export async function syncDashboardAfterTripGone(
  router: AppRouterInstance,
  refetchTrips?: () => Promise<void>
): Promise<void> {
  await refetchTrips?.();
  router.replace("/dashboard");
}
