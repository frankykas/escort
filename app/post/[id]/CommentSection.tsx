"use client";

import Image from "next/image";
import Link from "next/link";
import { useComment, type CommentRow } from "@/hooks/useComment";
import { CommentInput } from "./CommentInput";

type Props = {
  postId: string;
  userId: string | null;
  initialComments: CommentRow[];
  profileId: string;
};

function formatTimestamp(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CommentSection({ postId, userId, initialComments }: Props) {
  const { comments, submit, submitting } = useComment({
    postId,
    userId,
    initialComments,
  });

  return (
    <div>
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="divide-y divide-zinc-900">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2.5 px-3 py-3">
              {/* Avatar */}
              <Link href={`/u/${comment.profiles.username}`} className="flex-shrink-0">
                {comment.profiles.avatar_url ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
                    <Image
                      src={comment.profiles.avatar_url}
                      alt={comment.profiles.username}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                    {comment.profiles.username[0].toUpperCase()}
                  </div>
                )}
              </Link>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] leading-relaxed text-zinc-100">
                  <Link
                    href={`/u/${comment.profiles.username}`}
                    className="font-semibold text-white hover:underline mr-1.5"
                  >
                    {comment.profiles.username}
                  </Link>
                  {comment.body}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {formatTimestamp(comment.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <CommentInput userId={userId} onSubmit={submit} submitting={submitting} />
    </div>
  );
}
