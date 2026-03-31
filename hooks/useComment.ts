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
  const [comments] = useState<CommentRow[]>(initialComments);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = useCallback(
    async (body: string) => {
      if (!userId || !body.trim()) return;
      setSubmitting(true);

      const { error } = await supabase
        .from("comments")
        .insert({ status_update_id: postId, user_id: userId, body: body.trim() });

      if (!error) {
        setSent(true);
        setTimeout(() => setSent(false), 4000);
      }
      setSubmitting(false);
    },
    [postId, userId]
  );

  return { comments, submit, submitting, sent };
}
