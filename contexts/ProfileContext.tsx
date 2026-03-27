"use client";

/**
 * ProfileContext — single source of truth for the authenticated user's profile.
 *
 * Architecture notes:
 * - One Supabase query per session. Re-fetches only when user.id changes.
 * - Every component that needs role or profile data consumes this context.
 *   Nothing fetches "id, username, is_provider" on its own.
 * - `refetch()` is exposed for after profile mutations (edit profile, toggle
 *   is_provider, etc.) so the nav and dashboard update without a full reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_provider: boolean;
  verification_status: "none" | "pending" | "verified";
};

type ProfileContextValue = {
  /** null when signed out or still loading */
  profile: UserProfile | null;
  /** Convenience shorthand — false while loading */
  isProvider: boolean;
  /** True until both auth and profile have resolved */
  loading: boolean;
  /** Call after any profile mutation to sync context */
  refetch: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isProvider: false,
  loading: true,
  refetch: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, checked } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, is_provider, verification_status")
      .eq("id", userId)
      .single();

    if (error) {
      // Profile row not yet created (e.g. new auth user before trigger fires)
      setProfile(null);
    } else {
      setProfile(data as UserProfile);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!checked) return; // Wait for auth to resolve before touching DB

    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    fetchProfile(user.id);
  }, [user?.id, checked, fetchProfile]); // user?.id — only refetch on actual user change

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      isProvider: profile?.is_provider ?? false,
      loading: !checked || profileLoading,
      refetch: () => { if (user) fetchProfile(user.id); },
    }),
    [profile, checked, profileLoading, user, fetchProfile]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
