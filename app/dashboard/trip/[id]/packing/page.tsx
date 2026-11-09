"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import TripHero from "@/components/trip/trip-hero";
import { formatTripDateRange } from "@/lib/format-trip-dates";
import { PackingList } from "@/components/packing/packing-list";
import { PACKING_GROUP_KEY_EVERYONE } from "@/lib/list-grouping";
import {
  updatePackingItem,
  reorderPackingItems,
} from "@/lib/packing/packing-item-mutations";
import { DASHBOARD_TRIP_SUBPAGE_SHELL } from "@/components/trip/dashboard-card-styles";
import { useDashboardTripsOptional } from "@/components/dashboard/dashboard-trips-context";
import { fetchTripByIdForUser } from "@/lib/fetch-trip-for-user";
import { syncDashboardAfterTripGone } from "@/lib/dashboard/sync-after-trip-gone";
import { useTripCoverSignedUrl } from "@/app/lib/useTripCoverSignedUrl";
import { getParticipantAvatarDisplayUrl } from "@/lib/trip-media/resolve-participant-avatar";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  media?: unknown;
  created_at: string | null;
};

export type PackingCategory = {
  id: string;
  trip_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type PackingItem = {
  id: string;
  trip_id: string;
  category_id: string;
  title: string;
  quantity: number;
  is_packed: boolean;
  assigned_to_participant_id: string | null;
  sort_order: number;
};

export type PackingParticipant = {
  id: string;
  name: string;
};


export default function PackingPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const dashboardTrips = useDashboardTripsOptional();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { canEditContent } = useTripRole(trip, user?.id ?? undefined);
  const [tripLoading, setTripLoading] = useState(true);
  const tripHeroCoverUrl = useTripCoverSignedUrl(trip, "original");
  const tripCoverPreviewUrl = useTripCoverSignedUrl(trip, "preview");
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);
  const [categories, setCategories] = useState<PackingCategory[]>([]);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [participants, setParticipants] = useState<PackingParticipant[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const reloadCategoriesAndItems = useCallback(async () => {
    if (!id) return;
    const [catRes, itemsRes] = await Promise.all([
      supabase
        .from("packing_categories")
        .select("id, trip_id, name, icon, sort_order")
        .eq("trip_id", id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("packing_items")
        .select("id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id, sort_order")
        .eq("trip_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (!catRes.error && catRes.data) setCategories((catRes.data ?? []) as PackingCategory[]);
    if (!itemsRes.error && itemsRes.data) setItems((itemsRes.data ?? []) as PackingItem[]);
  }, [id]);

  /**
   * Saves a category's full item order (one RPC call). Items not yet in the category are moved
   * into it. Optimistic: update state first, reload if the save fails.
   */
  const saveCategoryOrder = useCallback(
    async (categoryId: string, orderedIds: string[]) => {
      if (!id) return;
      const position = new Map(orderedIds.map((itemId, index) => [itemId, index]));
      setItems((prev) =>
        prev
          .map((i) =>
            position.has(i.id)
              ? { ...i, category_id: categoryId, sort_order: position.get(i.id)! }
              : i
          )
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      const { error } = await reorderPackingItems(supabase, id, categoryId, orderedIds);
      if (error) await reloadCategoriesAndItems();
    },
    [id, reloadCategoriesAndItems]
  );

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/");
      return;
    }
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user || !id) {
      setTripLoading(false);
      return;
    }
    let cancelled = false;
    fetchTripByIdForUser<Trip>(supabase, id).then(({ trip, error }) => {
      if (cancelled) return;
      if (!error && trip) {
        setTrip(trip);
        setTripLoading(false);
      } else if (!error && !trip) {
        setTripLoading(false);
        void syncDashboardAfterTripGone(router, dashboardTrips?.refetchTrips);
      } else {
        setTripLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!id) {
      setParticipantAvatarUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("trip_participants")
      .select("avatar_path, media, sort_order")
      .eq("trip_id", id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null; media?: unknown }[];
        Promise.all(
          rows.map((r) => getParticipantAvatarDisplayUrl(supabase, r, "thumb"))
        ).then((urls) => {
          if (!cancelled) setParticipantAvatarUrls(urls);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !trip) {
      setListLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { error: rpcError } = await supabase.rpc("ensure_default_packing_categories", {
        p_trip_id: id,
      });
      if (cancelled || rpcError) {
        if (!cancelled) setListLoading(false);
        return;
      }

      const [catRes, itemsRes, partRes] = await Promise.all([
        supabase
          .from("packing_categories")
          .select("id, trip_id, name, icon, sort_order")
          .eq("trip_id", id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("packing_items").select("id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id, sort_order").eq("trip_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true }),
        supabase
          .from("trip_participants")
          .select("id, name")
          .eq("trip_id", id)
          .order("sort_order", { ascending: true }),
      ]);

      if (cancelled) return;
      if (!catRes.error && catRes.data) setCategories((catRes.data ?? []) as PackingCategory[]);
      if (!itemsRes.error && itemsRes.data) setItems((itemsRes.data ?? []) as PackingItem[]);
      if (!partRes.error && partRes.data) setParticipants((partRes.data ?? []) as PackingParticipant[]);
      setListLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, trip]);

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
        <div className={DASHBOARD_TRIP_SUBPAGE_SHELL}>
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className={DASHBOARD_TRIP_SUBPAGE_SHELL}>
        {tripLoading ? (
          <p className="text-[#6B7280]">Loading…</p>
        ) : trip ? (
          <>
            <TripHero
              title={trip.title}
              dates={formatTripDateRange(trip.start_date, trip.end_date)}
              imageUrl={tripHeroCoverUrl ?? undefined}
              onBack={() => router.push(`/dashboard/trip/${id}`)}
              participants={participantAvatarUrls.map((avatarUrl) => ({ avatarUrl }))}
            />
            <PackingList
              tripId={id}
              tripTitle={trip.title}
              categories={categories}
              items={items}
              participants={participants}
              participantAvatarUrls={participantAvatarUrls}
              tripCoverImageUrl={tripCoverPreviewUrl ?? null}
              loading={listLoading}
              canEditContent={canEditContent}
              onRefresh={reloadCategoriesAndItems}
              onItemsPatched={(itemId, patch) => {
                setItems((prev) =>
                  prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i))
                );
              }}
              onReorderGroup={async (newOrderedItems) => {
                const categoryId = newOrderedItems[0]?.category_id;
                if (!categoryId) return;
                // The list may be filtered by assignee, so newOrderedItems can be a subset of the
                // category. Put the visible items back into the slots they occupied and keep the
                // hidden ones where they are, so the saved order covers the whole category.
                const shown = new Set(newOrderedItems.map((i) => i.id));
                const queue = newOrderedItems.map((i) => i.id);
                const orderedIds = items
                  .filter((i) => i.category_id === categoryId)
                  .map((i) => (shown.has(i.id) ? queue.shift()! : i.id));
                await saveCategoryOrder(categoryId, orderedIds);
              }}
              onMoveItem={async (viewMode, item, fromGroupKey, toGroupKey, insertIndex) => {
                if (fromGroupKey === toGroupKey) return;

                if (viewMode === "participant") {
                  /**
                   * Person view only reassigns. Persisted assignee must never be `undefined`:
                   * PostgREST JSON.stringify drops undefined keys, so the PATCH would be empty.
                   */
                  const nextAssignedTo: string | null =
                    toGroupKey === PACKING_GROUP_KEY_EVERYONE ? null : toGroupKey;
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, assigned_to_participant_id: nextAssignedTo } : i
                    )
                  );
                  const { error } = await updatePackingItem(
                    supabase,
                    item.id,
                    { assigned_to_participant_id: nextAssignedTo },
                    "move-participant"
                  );
                  if (error) await reloadCategoriesAndItems();
                  return;
                }

                // Category view: save the destination category's full order once.
                const orderedIds = items
                  .filter((i) => i.category_id === toGroupKey && i.id !== item.id)
                  .map((i) => i.id);
                orderedIds.splice(insertIndex, 0, item.id);
                await saveCategoryOrder(toGroupKey, orderedIds);
              }}
            />
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[#6B7280]">Trip not found.</p>
            <button
              type="button"
              className="text-sm font-medium text-[#E07A5F] hover:text-[#c46950]"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
