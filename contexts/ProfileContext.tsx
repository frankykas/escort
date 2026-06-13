"use client";

/**
 * ProfileContext — single source of truth for the authenticated user's profile.
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
import { useLastActive } from "@/hooks/useLastActive";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderType = "creator" | "escort" | null;

export type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_provider: boolean;
  provider_type: ProviderType;
  verification_status: "none" | "pending" | "verified";
  onboarding_completed: boolean;
};

type ProfileContextValue = {
  /** null when signed out or still loading */
  profile: UserProfile | null;
  /** true if creator OR escort — backward-compat shorthand */
  isProvider: boolean;
  /** true only for content-only creators (OF section) */
  isCreator: boolean;
  /** true only for escorts (listings + content) */
  isEscort: boolean;
  /** Raw provider type value */
  providerType: ProviderType;
  /** True until both auth and profile have resolved */
  loading: boolean;
  /** Call after any profile mutation to sync context */
  refetch: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isProvider: false,
  isCreator: false,
  isEscort: false,
  providerType: null,
  loading: true,
  refetch: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, checked } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Track last active status
  useLastActive(user?.id);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, is_provider, provider_type, verification_status, onboarding_completed")
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
      isProvider: profile?.provider_type != null,
      isCreator: profile?.provider_type === "creator",
      isEscort: profile?.provider_type === "escort",
      providerType: profile?.provider_type ?? null,
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
