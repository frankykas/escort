"use client";

import Image from "next/image";
import Link from "next/link";
import { useComment, type CommentRow } from "@/hooks/useComment";
import { CommentInput } from "./CommentInput";
import { ReportButton } from "@/components/ui/ReportButton";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  postId: string;
  userId: string | null;
  initialComments: CommentRow[];
  profileId: string;
};

function formatTimestamp(isoString: string, t: (k: import("@/lib/i18n/en").TranslationKey) => string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time_just_now");
  if (minutes < 60) return `${minutes}${t("time_m_ago")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("time_h_ago")}`;
  const days = Math.floor(hours / 24);
  return `${days}${t("time_d_ago")}`;
}

export function CommentSection({ postId, userId, initialComments }: Props) {
  const { t } = useTranslation();
  const { comments, submit, submitting, sent } = useComment({
    postId,
    userId,
    initialComments,
  });

  return (
    <div>
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="divide-y divide-gray-100">
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-xs font-semibold text-pink-400">
                    {comment.profiles.username[0].toUpperCase()}
                  </div>
                )}
              </Link>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] leading-relaxed text-slate-700">
                    <Link
                      href={`/u/${comment.profiles.username}`}
                      className="font-semibold text-slate-800 hover:underline mr-1.5"
                    >
                      {comment.profiles.username}
                    </Link>
                    {comment.body}
                  </p>
                  <ReportButton
                    targetType="message"
                    targetId={comment.id}
                    className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {formatTimestamp(comment.created_at, t)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent confirmation */}
      {sent && (
        <div className="px-3 py-2">
          <p className="text-[12px] text-emerald-600">
            {t("post_comment_sent_long")}
          </p>
        </div>
      )}

      {/* Input */}
      <CommentInput userId={userId} onSubmit={submit} submitting={submitting} />
    </div>
  );
}
