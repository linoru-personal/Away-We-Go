"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import { useTripRole } from "@/app/lib/useTripRole";
import TripHero from "@/components/trip/trip-hero";
import { PackingList } from "@/components/packing/packing-list";

type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
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
};

export type PackingParticipant = {
  id: string;
  name: string;
};

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? "—";
}

export default function PackingPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? null;

  const { user, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const { canEditContent } = useTripRole(trip, user?.id ?? undefined);
  const [tripLoading, setTripLoading] = useState(true);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [participantAvatarUrls, setParticipantAvatarUrls] = useState<(string | null)[]>([]);
  const [categories, setCategories] = useState<PackingCategory[]>([]);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [participants, setParticipants] = useState<PackingParticipant[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (!trip?.cover_image_path) {
      setCoverImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("trip-covers")
      .createSignedUrl(trip.cover_image_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setCoverImageUrl(data.signedUrl);
        else setCoverImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.cover_image_path]);

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
    supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setTrip(data as Trip);
        setTripLoading(false);
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
      .select("avatar_path, sort_order")
      .eq("trip_id", id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setParticipantAvatarUrls([]);
          return;
        }
        const rows = (data ?? []) as { avatar_path: string | null }[];
        Promise.all(
          rows.map(async (r) => {
            if (!r.avatar_path) return null;
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(r.avatar_path, 3600);
            return signed?.signedUrl ?? null;
          })
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
        supabase.from("packing_items").select("id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id").eq("trip_id", id),
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
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
          <p className="text-[#6B7280]">Missing trip id.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        {tripLoading ? (
          <p className="text-[#6B7280]">Loading…</p>
        ) : trip ? (
          <>
            <TripHero
              title={trip.title}
              dates={formatDates(trip.start_date, trip.end_date)}
              imageUrl={coverImageUrl ?? trip.cover_image_url ?? undefined}
              onBack={() => router.push(`/dashboard/trip/${id}`)}
              participants={participantAvatarUrls.map((avatarUrl) => ({ avatarUrl }))}
            />
            <PackingList
              tripId={id}
              categories={categories}
              items={items}
              participants={participants}
              participantAvatarUrls={participantAvatarUrls}
              tripCoverImageUrl={coverImageUrl ?? trip.cover_image_url ?? null}
              loading={listLoading}
              canEditContent={canEditContent}
              onRefresh={async () => {
                const [catRes, itemsRes] = await Promise.all([
                  supabase
                    .from("packing_categories")
                    .select("id, trip_id, name, icon, sort_order")
                    .eq("trip_id", id)
                    .order("sort_order", { ascending: true })
                    .order("name", { ascending: true }),
                  supabase.from("packing_items").select("id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id").eq("trip_id", id),
                ]);
                if (!catRes.error && catRes.data) setCategories((catRes.data ?? []) as PackingCategory[]);
                if (!itemsRes.error && itemsRes.data) setItems((itemsRes.data ?? []) as PackingItem[]);
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
