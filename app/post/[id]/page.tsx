import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { ReportButton } from "@/components/ui/ReportButton";
import { PostActions } from "./PostActions";
import { CommentSection } from "./CommentSection";
import type { CommentRow } from "@/hooks/useComment";

type PostProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  verification_status: "none" | "pending" | "verified";
};

type PostData = {
  id: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  profiles: PostProfile;
};

function formatTimestamp(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Props = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-zinc-500">Supabase not configured.</p>
      </main>
    );
  }

  // Parallel: post + comments + current user
  const [postResult, commentsResult, sessionResult] = await Promise.all([
    supabase
      .from("status_updates")
      .select(
        `id, caption, media_url, created_at, likes_count, comments_count, views_count,
         profiles!status_updates_provider_id_fkey(id, username, avatar_url, verification_status)`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("comments")
      .select(
        "id, body, created_at, profiles!comments_user_id_fkey(username, avatar_url)"
      )
      .eq("status_update_id", id)
      .eq("is_approved", true)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase.auth.getUser(),
  ]);

  if (postResult.error || !postResult.data) notFound();

  const post = postResult.data as unknown as PostData;
  const comments = (commentsResult.data ?? []) as unknown as CommentRow[];
  const currentUserId = sessionResult.data.user?.id ?? null;

  // Check if liked
  let initialIsLiked = false;
  if (currentUserId) {
    const { data } = await supabase
      .from("likes")
      .select("user_id")
      .eq("user_id", currentUserId)
      .eq("status_update_id", id)
      .maybeSingle();
    initialIsLiked = !!data;
  }

  const { username, avatar_url, verification_status, id: profileId } = post.profiles;
  const isVerified = verification_status === "verified";

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-lg">
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800 bg-black/80 px-4 py-3 backdrop-blur-md">
          <BackButton />
          <span className="text-sm font-semibold text-white">Post</span>
        </header>

        {/* ── Post author row ── */}
        <Link href={`/u/${username}`} className="flex items-center gap-2.5 px-3 py-3 hover:bg-zinc-900/50 transition-colors">
          <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex-shrink-0">
            <div className="rounded-full p-[1.5px] bg-black">
              {avatar_url ? (
                <div className="relative h-9 w-9 overflow-hidden rounded-full">
                  <Image src={avatar_url} alt={username} fill className="object-cover" sizes="36px" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                  {username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold text-white">{username}</span>
            {isVerified && (
              <CheckCircle size={12} className="text-amber-400 fill-amber-400/20 flex-shrink-0" />
            )}
          </div>
        </Link>

        {/* ── Full image ── */}
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

        {/* ── Like / bookmark actions ── */}
        <PostActions
          postId={post.id}
          initialIsLiked={initialIsLiked}
          initialCount={post.likes_count}
          userId={currentUserId}
        />

        {/* ── Caption ── */}
        {post.caption && (
          <div className="px-3 pt-1 pb-2">
            <p className="text-[13px] leading-relaxed text-zinc-100">
              <Link
                href={`/u/${username}`}
                className="font-semibold text-white hover:underline mr-1.5"
              >
                {username}
              </Link>
              {post.caption}
            </p>
          </div>
        )}

        {/* ── Timestamp ── */}
        <div className="flex items-center justify-between px-3 pb-3">
          <p className="text-[11px] text-zinc-600">{formatTimestamp(post.created_at)}</p>
          <ReportButton targetType="post" targetId={post.id} />
        </div>

        {/* ── Comments section ── */}
        <div className="border-t border-zinc-800">
          <CommentSection
            postId={post.id}
            userId={currentUserId}
            initialComments={comments}
            profileId={profileId}
          />
        </div>
      </div>
    </main>
  );
}
