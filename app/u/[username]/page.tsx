import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle, MapPin, Star } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { ProfileActions } from "./ProfileActions";
import { ProfileTabs } from "./ProfileTabs";
import { HeroCarousel } from "./HeroCarousel";
import { EnquireBar } from "./EnquireBar";
import { USE_BOOKINGS } from "@/lib/features";
import type { ProfileAttributes } from "./ProfileTabs";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function isAvailableNow(availableUntil: string | null): boolean {
  if (!availableUntil) return false;
  return new Date(availableUntil) > new Date();
}

type Props = { params: Promise<{ username: string }> };

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = createServerClient();

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-500">Supabase not configured.</p>
      </main>
    );
  }

  // Fetch profile with all attribute columns
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `id, username, avatar_url, bio, bio_long, verification_status, is_provider,
       city, country_code, incall, outcall, age, available_until,
       height_cm, build, hair_color, eye_color, nationality, languages,
       review_count, average_rating, completed_bookings_count`
    )
    .eq("username", username)
    .single();

  if (profileError || !profile) notFound();

  // Parallel fetches
  const [postsResult, listingsResult, followersResult, followingResult, sessionResult, reviewsResult] =
    await Promise.all([
      supabase
        .from("status_updates")
        .select("id, media_url, likes_count, comments_count")
        .eq("provider_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("listings")
        .select("id, title, description, duration_minutes, rate, sort_order")
        .eq("provider_id", profile.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      supabase.auth.getUser(),
      supabase
        .from("reviews")
        .select(`
          id, rating, body, created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(username, avatar_url)
        `)
        .eq("reviewee_id", profile.id)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const posts = postsResult.data ?? [];
  const listings = listingsResult.data ?? [];
  const followersCount = followersResult.count ?? 0;
  const followingCount = followingResult.count ?? 0;
  const currentUserId = sessionResult.data.user?.id ?? null;
  const reviews = (reviewsResult.data ?? []) as unknown as import("./ProfileTabs").ReviewItem[];
  const reviewCount = (profile.review_count as number) ?? 0;
  const avgRating = (profile.average_rating as number | null) ?? null;
  const completedBookings = (profile.completed_bookings_count as number) ?? 0;
  const isOwnProfile = currentUserId === profile.id;

  // Check follow state
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
  const available = isAvailableNow(profile.available_until as string | null);
  const photos = posts
    .filter((p) => p.media_url)
    .map((p) => ({ id: p.id, url: p.media_url as string }));

  const attributes: ProfileAttributes = {
    bio: profile.bio as string | null,
    bio_long: profile.bio_long as string | null,
    height_cm: profile.height_cm as number | null,
    build: profile.build as string | null,
    hair_color: profile.hair_color as string | null,
    eye_color: profile.eye_color as string | null,
    nationality: profile.nationality as string | null,
    languages: (profile.languages as string[]) ?? [],
    city: profile.city as string | null,
    country_code: profile.country_code as string | null,
    incall: profile.incall as boolean,
    outcall: profile.outcall as boolean,
    age: profile.age as number | null,
  };

  return (
    <main className="min-h-screen bg-zinc-950 pb-44">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        <BackButton />
        <span className="text-sm font-semibold text-white">{profile.username}</span>
        {isVerified && (
          <CheckCircle size={13} className="fill-amber-400/20 text-amber-400" />
        )}
      </header>

      {/* ── Hero photo carousel ── */}
      <HeroCarousel photos={photos} username={profile.username as string} />

      {/* ── Profile info ── */}
      <div className="-mt-20 px-4 pb-0">
        {/* Avatar */}
        <div className="inline-block rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-[3px] shadow-[0_0_20px_rgba(251,191,36,0.2)]">
          <div className="rounded-full bg-zinc-950 p-[2px]">
            {profile.avatar_url ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-full">
                <Image
                  src={profile.avatar_url as string}
                  alt={profile.username as string}
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold text-zinc-300">
                {(profile.username as string)[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name + verified + available */}
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">{profile.username as string}</h1>
          {isVerified && (
            <CheckCircle size={16} className="flex-shrink-0 fill-amber-400/20 text-amber-400" />
          )}
          {available && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">Available</span>
            </span>
          )}
        </div>

        {/* City + age */}
        {(profile.city || profile.age) && (
          <div className="mt-1 flex items-center gap-1 text-zinc-500">
            {profile.city && <MapPin size={11} className="flex-shrink-0" />}
            <span className="text-[13px]">
              {[profile.city, profile.age ? `Age ${profile.age}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}

        {/* Rating + completed bookings */}
        {(avgRating !== null || (USE_BOOKINGS && completedBookings > 0)) && (
          <div className="mt-2 flex items-center gap-3">
            {avgRating !== null && (
              <div className="flex items-center gap-1.5">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span className="text-[13px] font-semibold text-white">{Number(avgRating).toFixed(1)}</span>
                <span className="text-[12px] text-zinc-500">({reviewCount})</span>
              </div>
            )}
            {USE_BOOKINGS && completedBookings > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                {completedBookings} completed
              </span>
            )}
          </div>
        )}

        {/* Short bio */}
        {profile.bio && !profile.bio_long && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
            {profile.bio as string}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6">
          <StatItem value={formatCount(posts.length)} label="Posts" />
          <div className="h-8 w-px bg-white/5" />
          <StatItem value={formatCount(followersCount)} label="Followers" />
          <div className="h-8 w-px bg-white/5" />
          <StatItem value={formatCount(followingCount)} label="Following" />
          {listings.length > 0 && (
            <>
              <div className="h-8 w-px bg-white/5" />
              <StatItem value={formatCount(listings.length)} label="Listings" />
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="mb-5 mt-4">
          <ProfileActions
            profileId={profile.id as string}
            initialIsFollowing={initialIsFollowing}
            userId={currentUserId}
            isOwnProfile={isOwnProfile}
          />
        </div>
      </div>

      {/* ── Tabs: Posts / Listings / About / Reviews ── */}
      <ProfileTabs
        posts={posts}
        listings={listings as import("./ProfileTabs").ListingItem[]}
        attributes={attributes}
        reviews={reviews}
        avgRating={avgRating}
        isOwnProfile={isOwnProfile}
      />

      {/* ── Sticky enquire bar ── */}
      <EnquireBar username={profile.username as string} providerId={profile.id as string} isOwnProfile={isOwnProfile} />
    </main>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[15px] font-bold text-white">{value}</span>
      <span className="mt-0.5 text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}
