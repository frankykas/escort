"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "./useSession";

interface UseShareOptions {
  postId: string;
  initialCount?: number;
  userId: string | null;
}

export function useShare({ postId, initialCount = 0, userId }: UseShareOptions) {
  const [sharesCount, setSharesCount] = useState(initialCount);
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async () => {
    if (!userId || !postId || isSharing) return;

    setIsSharing(true);
    try {
      const { error } = await supabase
        .from("shares")
        .insert({ user_id: userId, status_update_id: postId });

      if (error) {
        // If already shared, don't show error to user
        if (error.code !== "23505") { // 23505 = unique_violation
          console.error("Error sharing post:", error);
        }
        return;
      }

      setSharesCount(prev => prev + 1);
    } catch (error) {
      console.error("Error sharing post:", error);
    } finally {
      setIsSharing(false);
    }
  }, [userId, postId, isSharing]);

  return {
    share,
    sharesCount,
    isSharing,
  };
}
