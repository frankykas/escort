import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Grid3X3, Heart, MessageCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { ProfileActions } from "./ProfileActions";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type Props = { params: Promise<{ username: string }> };

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = createServerClient();

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-sm text-zinc-500">Supabase not configured.</p>
      </main>
    );
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio, verification_status")
    .eq("username", username)
    .single();

  if (profileError || !profile) notFound();

  // Parallel: posts + follower count + following count + current user session
  const [postsResult, followersResult, followingResult, sessionResult] =
    await Promise.all([
      supabase
        .from("status_updates")
        .select("id, media_url, likes_count, comments_count")
        .eq("provider_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      supabase.auth.getUser(),
    ]);

  const posts = postsResult.data ?? [];
  const followersCount = followersResult.count ?? 0;
  const followingCount = followingResult.count ?? 0;
  const currentUserId = sessionResult.data.user?.id ?? null;
  const isOwnProfile = currentUserId === profile.id;

  // Check if current user follows this profile
  let initialIsFollowing = false;
  if (currentUserId && !isOwnProfile) {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", profile.id)
      .maybeSingle();
    initialIsFollowing = !!data;
  }

  const isVerified = profile.verification_status === "verified";
  const bannerUrl = posts.find((p) => p.media_url)?.media_url ?? null;

  return (
    <main className="min-h-screen bg-black">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800 bg-black/80 px-4 py-3 backdrop-blur-md">
        <BackButton />
        <span className="text-sm font-semibold text-white">{profile.username}</span>
        {isVerified && (
          <CheckCircle size={14} className="text-amber-400 fill-amber-400/20" />
        )}
      </header>

      {/* ── Cover banner ── */}
      <div className="relative h-36 w-full overflow-hidden bg-zinc-900">
        {bannerUrl ? (
          <>
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover scale-110 blur-xl brightness-40"
              sizes="100vw"
              priority
            />
            {/* Amber vignette at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-amber-900/40 via-zinc-900 to-black" />
        )}
      </div>

      {/* ── Profile info (overlaps banner) ── */}
      <div className="-mt-12 px-4 pb-0">
        {/* Avatar */}
        <div className="rounded-full p-[3px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 inline-block">
          <div className="rounded-full p-[2px] bg-black">
            {profile.avatar_url ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-full">
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold text-zinc-300">
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name + verified */}
        <div className="mt-3 flex items-center gap-1.5">
          <h1 className="text-xl font-bold text-white">{profile.username}</h1>
          {isVerified && (
            <CheckCircle size={16} className="text-amber-400 fill-amber-400/20 flex-shrink-0" />
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-[15px] font-bold text-white">{formatCount(posts.length)}</span>
            <span className="text-[11px] text-zinc-500 mt-0.5">Posts</span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-[15px] font-bold text-white">{formatCount(followersCount)}</span>
            <span className="text-[11px] text-zinc-500 mt-0.5">Followers</span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-[15px] font-bold text-white">{formatCount(followingCount)}</span>
            <span className="text-[11px] text-zinc-500 mt-0.5">Following</span>
          </div>
        </div>

        {/* Follow / Edit buttons — client island */}
        <div className="mt-4 mb-5">
          <ProfileActions
            profileId={profile.id}
            initialIsFollowing={initialIsFollowing}
            userId={currentUserId}
            isOwnProfile={isOwnProfile}
          />
        </div>
      </div>

      {/* ── Posts grid tab bar ── */}
      <div className="border-t border-zinc-800 flex items-center justify-center py-2.5">
        <div className="flex items-center gap-1.5 text-white">
          <Grid3X3 size={16} />
          <span className="text-xs font-semibold tracking-wider uppercase">Posts</span>
        </div>
      </div>

      {/* ── 3-col grid ── */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-zinc-600">No posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[1px] bg-zinc-800">
          {posts.map((post) => (
            <Link key={post.id} href={`/post/${post.id}`} className="group relative aspect-square overflow-hidden bg-zinc-900">
              {post.media_url ? (
                <Image
                  src={post.media_url}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                  sizes="(max-width: 768px) 33vw, 200px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                  <span className="text-zinc-700 text-xs">No image</span>
                </div>
              )}
              {/* Hover overlay with engagement counts */}
              <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span className="flex items-center gap-1 text-sm font-semibold text-white">
                  <Heart size={16} className="fill-white" />
                  {formatCount(post.likes_count)}
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-white">
                  <MessageCircle size={16} className="fill-white" />
                  {formatCount(post.comments_count)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
