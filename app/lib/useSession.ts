"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { claimPendingTripInvitations } from "@/lib/claim-pending-trip-invitations";
import { supabase } from "./supabaseClient";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { user: initialUser },
      } = await supabase.auth.getUser();
      if (mounted) {
        setUser(initialUser ?? null);
        setLoading(false);
      }
      if (mounted && initialUser) {
        void claimPendingTripInvitations(supabase);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
      if (
        mounted &&
        session?.user &&
        (event === "SIGNED_IN" || event === "USER_UPDATED")
      ) {
        void claimPendingTripInvitations(supabase);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
