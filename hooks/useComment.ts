"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
};

type Args = {
  postId: string;
  userId: string | null;
  initialComments: CommentRow[];
};

export function useComment({ postId, userId, initialComments }: Args) {
  const [comments, setComments] = useState<CommentRow[]>(initialComments);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (body: string) => {
      if (!userId || !body.trim()) return;
      setSubmitting(true);

      const { data, error } = await supabase
        .from("comments")
        .insert({ status_update_id: postId, user_id: userId, body: body.trim() })
        .select(
          "id, body, created_at, profiles!comments_user_id_fkey(username, avatar_url)"
        )
        .single();

      if (!error && data) {
        setComments((prev) => [...prev, data as unknown as CommentRow]);
      }
      setSubmitting(false);
    },
    [postId, userId]
  );

  return { comments, submit, submitting };
}
