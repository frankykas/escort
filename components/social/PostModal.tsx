"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, CheckCircle, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useLike } from "@/hooks/useLike";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Comment = {
  id: string;
  body: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

type PostData = {
  id: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  provider_id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
};

type Props = {
  postId: string;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function PostModal({ postId, onClose }: Props) {
  const { user } = useSession();
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLiked, setInitialLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentSent, setCommentSent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch post + comments
  useEffect(() => {
    async function load() {
      const [postRes, commentsRes] = await Promise.all([
        supabase
          .from("status_updates")
          .select(`
            id, caption, media_url, created_at, likes_count, comments_count, provider_id,
            profiles!status_updates_provider_id_fkey(username, avatar_url, verification_status)
          `)
          .eq("id", postId)
          .single(),
        supabase
          .from("comments")
          .select("id, body, created_at, profiles!comments_user_id_fkey(username, avatar_url)")
          .eq("status_update_id", postId)
          .eq("is_approved", true)
          .order("created_at", { ascending: true })
          .limit(100),
      ]);

      if (postRes.data) {
        const p = postRes.data as Record<string, unknown>;
        const profile = p.profiles as { username: string; avatar_url: string | null; verification_status: string };
        setPost({
          id: p.id as string,
          caption: p.caption as string | null,
          media_url: p.media_url as string | null,
          created_at: p.created_at as string,
          likes_count: p.likes_count as number,
          comments_count: p.comments_count as number,
          provider_id: p.provider_id as string,
          username: profile.username,
          avatar_url: profile.avatar_url,
          verification_status: profile.verification_status,
        });
      }

      if (commentsRes.data) {
        setComments(
          (commentsRes.data as Array<Record<string, unknown>>).map((c) => {
            const prof = c.profiles as { username: string; avatar_url: string | null };
            return {
              id: c.id as string,
              body: c.body as string,
              created_at: c.created_at as string,
              username: prof.username,
              avatar_url: prof.avatar_url,
            };
          })
        );
      }

      // Check if liked
      if (user) {
        const { data } = await supabase
          .from("likes")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("status_update_id", postId)
          .maybeSingle();
        setInitialLiked(!!data);
      }

      setLoading(false);
    }

    load();
  }, [postId, user]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleComment() {
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("comments")
      .insert({ status_update_id: postId, user_id: user.id, body: commentText.trim() });
    if (!error) {
      setCommentText("");
      setCommentSent(true);
      setTimeout(() => setCommentSent(false), 4000);
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!user || !post || deleting) return;
    setDeleting(true);
    const { error } = await supabase
      .from("status_updates")
      .delete()
      .eq("id", post.id)
      .eq("provider_id", user.id); // RLS + explicit check: only own posts
    if (!error) {
      onClose();
    } else {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  const isOwnPost = !!(user && post && post.provider_id === user.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl flex flex-col"
      >
        {/* Top-right buttons */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          {isOwnPost && (
            <div className="relative">
              <button
                onClick={() => { setMenuOpen(!menuOpen); setDeleteConfirm(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setDeleteConfirm(false); }} />
                  <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
                    {deleteConfirm ? (
                      <div className="p-3 space-y-2">
                        <p className="text-[12px] text-zinc-300 text-center">Delete this post?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 rounded-lg border border-white/10 py-1.5 text-[12px] font-medium text-zinc-400 hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500 py-1.5 text-[12px] font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                          >
                            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-red-400 transition hover:bg-zinc-800"
                      >
                        <Trash2 size={14} />
                        Delete post
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !post ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
              <Link href={`/u/${post.username}`} onClick={onClose} className="flex items-center gap-2.5">
                <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex-shrink-0">
                  <div className="rounded-full p-[1.5px] bg-zinc-950">
                    {post.avatar_url ? (
                      <div className="relative h-8 w-8 overflow-hidden rounded-full">
                        <Image src={post.avatar_url} alt={post.username} fill className="object-cover" sizes="32px" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                        {post.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-semibold text-white">{post.username}</span>
                    {post.verification_status === "verified" && (
                      <CheckCircle size={11} className="text-amber-400 fill-amber-400/20" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">{timeAgo(post.created_at)}</span>
                </div>
              </Link>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image */}
              {post.media_url && (
                <div className="relative aspect-square w-full bg-zinc-900">
                  <Image
                    src={post.media_url}
                    alt={post.caption ?? "Post"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 512px) 100vw, 512px"
                    priority
                  />
                </div>
              )}

              {/* Like bar */}
              <PostModalLikeBar
                postId={post.id}
                initialLiked={initialLiked}
                initialCount={post.likes_count}
                userId={user?.id ?? null}
              />

              {/* Caption */}
              {post.caption && (
                <div className="px-4 pb-2">
                  <p className="text-[13px] leading-relaxed text-zinc-100">
                    <Link href={`/u/${post.username}`} onClick={onClose} className="font-semibold text-white hover:underline mr-1.5">
                      {post.username}
                    </Link>
                    {post.caption}
                  </p>
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-white/5">
                {comments.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[13px] text-zinc-600">No comments yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5 px-4 py-3">
                        <Link href={`/u/${c.username}`} onClick={onClose} className="flex-shrink-0">
                          {c.avatar_url ? (
                            <div className="relative h-8 w-8 overflow-hidden rounded-full">
                              <Image src={c.avatar_url} alt={c.username} fill className="object-cover" sizes="32px" />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                              {c.username[0].toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] leading-relaxed text-zinc-100">
                            <Link href={`/u/${c.username}`} onClick={onClose} className="font-semibold text-white hover:underline mr-1.5">
                              {c.username}
                            </Link>
                            {c.body}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-600">{timeAgo(c.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment input */}
            {user && (
              <div className="border-t border-white/5 px-4 py-3">
                {commentSent && (
                  <p className="mb-2 text-[12px] text-emerald-400/80">Comment sent — visible once approved.</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || submitting}
                    className="text-[13px] font-semibold text-amber-400 transition hover:text-amber-300 disabled:opacity-40"
                  >
                    {submitting ? "..." : "Post"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Like bar sub-component (uses the hook)
// ---------------------------------------------------------------------------

function PostModalLikeBar({
  postId,
  initialLiked,
  initialCount,
  userId,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  userId: string | null;
}) {
  const { isLiked, likesCount, toggle } = useLike({
    postId,
    initialIsLiked: initialLiked,
    initialCount,
    userId,
  });

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={!userId}
          className="transition-transform active:scale-90 disabled:opacity-40"
        >
          <Heart
            size={24}
            className={cn(
              "transition-colors",
              isLiked ? "fill-red-500 text-red-500" : "text-zinc-100"
            )}
          />
        </button>
        <span className="text-[13px] font-semibold text-white">
          {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
        </span>
      </div>
    </div>
  );
}
