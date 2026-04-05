"use client";

import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLike } from "@/hooks/useLike";

type Props = {
  postId: string;
  initialIsLiked: boolean;
  initialCount: number;
  userId: string | null;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function PostActions({ postId, initialIsLiked, initialCount, userId }: Props) {
  const { isLiked, likesCount, toggle } = useLike({
    postId,
    initialIsLiked,
    initialCount,
    userId,
  });

  return (
    <div className="px-3 pt-3 pb-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={toggle}
            aria-label={isLiked ? "Unlike" : "Like"}
            whileTap={{ scale: 1.3 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Heart
              size={28}
              className={cn(
                "transition-colors",
                isLiked ? "fill-red-500 text-red-500" : "text-zinc-100"
              )}
            />
          </motion.button>
          <button aria-label="Comment" className="text-zinc-100 hover:text-zinc-400 transition-colors">
            <MessageCircle size={28} />
          </button>
          <button aria-label="Share" className="text-zinc-100 hover:text-zinc-400 transition-colors">
            <Send size={26} />
          </button>
        </div>
        <button aria-label="Save" className="text-zinc-100 hover:text-zinc-400 transition-colors">
          <Bookmark size={26} />
        </button>
      </div>

      <p className="mt-2 text-[13px] font-semibold text-white">
        {formatCount(likesCount)} likes
      </p>
    </div>
  );
}
