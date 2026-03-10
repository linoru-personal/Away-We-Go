"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export type TripRole = "owner" | "admin" | "editor" | "viewer" | null;

export type TripPermissions = {
  role: TripRole;
  canEditContent: boolean;
  canEditMetadata: boolean;
  canManageSharing: boolean;
  canDeleteTrip: boolean;
};

type TripWithOwner = { id: string; user_id: string };

/**
 * Derives the current user's role and permissions for a trip.
 * - Owner: trip.user_id === userId.
 * - Member: fetched from trip_members.role (admin, editor, viewer).
 */
export function useTripRole(
  trip: TripWithOwner | null,
  userId: string | undefined
): TripPermissions {
  const [memberRole, setMemberRole] = useState<"admin" | "editor" | "viewer" | null>(null);
  const [memberRoleLoaded, setMemberRoleLoaded] = useState(false);

  const isOwner = Boolean(trip && userId && trip.user_id === userId);

  useEffect(() => {
    if (!trip?.id || !userId || isOwner) {
      setMemberRole(null);
      setMemberRoleLoaded(true);
      return;
    }
    let cancelled = false;
    setMemberRoleLoaded(false);
    supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", trip.id)
      .eq("user_id", userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setMemberRole(null);
        } else {
          const r = (data as { role: string }).role;
          setMemberRole(r === "admin" || r === "editor" || r === "viewer" ? r : null);
        }
        setMemberRoleLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.id, userId, isOwner]);

  const role: TripRole = isOwner ? "owner" : memberRole;

  return {
    role,
    canEditContent: role === "owner" || role === "admin" || role === "editor",
    canEditMetadata: role === "owner" || role === "admin",
    canManageSharing: role === "owner" || role === "admin",
    canDeleteTrip: role === "owner",
  };
}
