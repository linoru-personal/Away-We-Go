"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type Profile = {
  id: string;
  username: string;
};

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    supabase
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setProfile(data as Profile);
        else setProfile(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refetch = () => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setProfile(data as Profile);
        else setProfile(null);
        setLoading(false);
      });
  };

  return { profile, loading, refetch };
}

export function getDisplayName(
  user: { email?: string | null } | null,
  profile: { username: string } | null
): string {
  const name = profile?.username ?? user?.email?.split("@")[0];
  return name && name.length > 0 ? name : "there";
}