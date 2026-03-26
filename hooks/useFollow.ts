"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

type Args = {
  profileId: string;
  initialIsFollowing: boolean;
  userId: string | null;
};

export function useFollow({ profileId, initialIsFollowing, userId }: Args) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const toggle = useCallback(async () => {
    if (!userId) return;

    const next = !isFollowing;
    setIsFollowing(next);

    const { error } = next
      ? await supabase
          .from("follows")
          .insert({ follower_id: userId, following_id: profileId })
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", profileId);

    if (error) {
      setIsFollowing(isFollowing);
    }
  }, [isFollowing, profileId, userId]);

  return { isFollowing, toggle };
}
