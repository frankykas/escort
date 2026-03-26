"use client";

import { useState, useCallback } from "react";
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

  const toggle = useCallback(async () => {
    if (!userId) return;

    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(c - 1, 0)));

    const { error } = next
      ? await supabase
          .from("likes")
          .insert({ user_id: userId, status_update_id: postId })
      : await supabase
          .from("likes")
          .delete()
          .eq("user_id", userId)
          .eq("status_update_id", postId);

    if (error) {
      // Revert optimistic update
      setIsLiked(isLiked);
      setLikesCount(initialCount);
    }
  }, [isLiked, initialCount, postId, userId]);

  return { isLiked, likesCount, toggle };
}
