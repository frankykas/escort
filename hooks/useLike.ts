"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type Args = {
  postId: string;
  initialIsLiked: boolean;
  initialCount: number;
  userId: string | null;
};

export function useLike({ postId, initialIsLiked, initialCount, userId }: Args) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialCount);

  // Sync with prop when parent updates (e.g. batch query finishes)
  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setLikesCount(initialCount);
  }, [initialCount]);

  const toggle = useCallback(async () => {
    if (!userId) return;

    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(c - 1, 0)));

    const { error } = next
      ? await supabase
          .from("likes")
          .upsert({ user_id: userId, status_update_id: postId }, { onConflict: "user_id,status_update_id" })
      : await supabase
          .from("likes")
          .delete()
          .eq("user_id", userId)
          .eq("status_update_id", postId);

    if (error) {
      // Revert optimistic update
      setIsLiked(!next);
      setLikesCount((c) => (next ? Math.max(c - 1, 0) : c + 1));
    }
  }, [postId, userId]);

  return { isLiked, likesCount, toggle };
}
