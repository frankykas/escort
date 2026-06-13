"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Check, X, Loader2, MessageCircle,
  CheckCheck, ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingComment = {
  comment_id: string;
  comment_body: string;
  comment_created: string;
  commenter_id: string;
  commenter_username: string;
  commenter_avatar: string | null;
  post_id: string;
  post_caption: string | null;
  post_media_url: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommentModerationPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const { isProvider } = useProfile();

  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const load = useCallback(async (offset = 0) => {
    if (!user) return;
    const { data } = await supabase.rpc("get_pending_comments", {
      p_provider_id: user.id,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    const rows = (data ?? []) as PendingComment[];
    setHasMore(rows.length === PAGE_SIZE);
    if (offset === 0) {
      setComments(rows);
    } else {
      setComments((prev) => [...prev, ...rows]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (checked && !user) {
    router.replace("/auth/signin");
    return null;
  }

  if (checked && !isProvider) {
    router.replace("/profile");
    return null;
  }

  async function handleAction(commentId: string, action: "approve" | "reject") {
    setActingOn((prev) => new Set(prev).add(commentId));

    const update = action === "approve"
      ? { is_approved: true, moderated_at: new Date().toISOString() }
      : { is_rejected: true, moderated_at: new Date().toISOString() };

    const { error } = await supabase
      .from("comments")
      .update(update)
      .eq("id", commentId);

    if (!error) {
      setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
    }

    setActingOn((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
  }

  async function handleApproveAll() {
    if (comments.length === 0) return;
    const ids = comments.map((c) => c.comment_id);
    setActingOn(new Set(ids));

    const { error } = await supabase
      .from("comments")
      .update({ is_approved: true, moderated_at: new Date().toISOString() })
      .in("id", ids);

    if (!error) {
      setComments([]);
    }
    setActingOn(new Set());
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#fafbfc]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-800">Comment Moderation</h1>
              {!loading && comments.length > 0 && (
                <p className="text-[11px] text-slate-500">{comments.length} pending</p>
              )}
            </div>
          </div>
          {comments.length > 1 && (
            <button
              onClick={handleApproveAll}
              disabled={actingOn.size > 0}
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-semibold text-emerald-500 transition hover:bg-emerald-100 disabled:opacity-40"
            >
              <CheckCheck size={13} />
              Approve All
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <ShieldCheck size={28} className="text-emerald-500" />
            </div>
            <p className="text-[15px] font-semibold text-slate-800">All clear!</p>
            <p className="text-[13px] text-slate-500 mt-1">
              No comments waiting for approval.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            <AnimatePresence>
              {comments.map((c) => {
                const acting = actingOn.has(c.comment_id);
                return (
                  <motion.div
                    key={c.comment_id}
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.25 }}
                    className="px-4 py-4"
                  >
                    {/* Post context */}
                    <div className="flex items-center gap-2.5 mb-3">
                      {c.post_media_url ? (
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <Image
                            src={c.post_media_url}
                            alt="Post"
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                          <MessageCircle size={16} className="text-slate-500" />
                        </div>
                      )}
                      <p className="text-[12px] text-slate-500 line-clamp-1 flex-1">
                        On: {c.post_caption ? `"${c.post_caption}"` : "your post"}
                      </p>
                    </div>

                    {/* Comment */}
                    <div className="flex items-start gap-3">
                      <Link href={`/u/${c.commenter_username}`} className="flex-shrink-0">
                        {c.commenter_avatar ? (
                          <div className="relative h-9 w-9 overflow-hidden rounded-full">
                            <Image
                              src={c.commenter_avatar}
                              alt={c.commenter_username}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-slate-500">
                            {c.commenter_username[0].toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/u/${c.commenter_username}`}
                            className="text-[13px] font-semibold text-slate-800 hover:text-pink-500"
                          >
                            @{c.commenter_username}
                          </Link>
                          <span className="text-[11px] text-slate-400">
                            {timeAgo(c.comment_created)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed">
                          {c.comment_body}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3 ml-12">
                      <button
                        onClick={() => handleAction(c.comment_id, "approve")}
                        disabled={acting}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12px] font-semibold transition-all",
                          "border-emerald-200 bg-emerald-50 text-emerald-500",
                          "hover:bg-emerald-100 active:scale-[0.97]",
                          "disabled:opacity-40"
                        )}
                      >
                        {acting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={13} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(c.comment_id, "reject")}
                        disabled={acting}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12px] font-semibold transition-all",
                          "border-red-200 bg-red-50 text-red-500",
                          "hover:bg-red-100 active:scale-[0.97]",
                          "disabled:opacity-40"
                        )}
                      >
                        <X size={13} />
                        Reject
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {hasMore && (
              <div className="flex justify-center py-6">
                <button
                  onClick={() => load(comments.length)}
                  className="rounded-full border border-gray-200 px-5 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
