"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type Args = {
  profileId: string;
  initialIsFollowing: boolean;
  userId: string | null;
};

export function useFollow({ profileId, initialIsFollowing, userId }: Args) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  // Sync with prop when parent updates (e.g. batch query finishes)
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  const toggle = useCallback(async () => {
    if (!userId) return;

    const next = !isFollowing;
    setIsFollowing(next);

    const { error } = next
      ? await supabase
          .from("follows")
          .upsert(
            { follower_id: userId, following_id: profileId },
            { onConflict: "follower_id,following_id" }
          )
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", profileId);

    if (error) {
      setIsFollowing(!next);
    }
  }, [isFollowing, profileId, userId]);

  return { isFollowing, toggle };
}
