import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle, MapPin, Clock, ShieldBan } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { ReportButton } from "@/components/ui/ReportButton";
import { ProfileActions } from "./ProfileActions";
import { ProfileTabs } from "./ProfileTabs";
import { HeroCarousel } from "./HeroCarousel";
import { EnquireBar } from "./EnquireBar";
import { USE_BOOKINGS } from "@/lib/features";
import { cn, formatLastSeen } from "@/lib/utils";
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
       completed_bookings_count,
       service_categories, hourly_rate,
       contact_whatsapp, contact_telegram, contact_phone`
    )
    .eq("username", username)
    .single();

  if (profileError || !profile) notFound();

  // Parallel fetches
  const [postsResult, listingsResult, followersResult, followingResult, sessionResult] =
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
    ]);

  const posts = postsResult.data ?? [];
  const listings = listingsResult.data ?? [];
  const followersCount = followersResult.count ?? 0;
  const followingCount = followingResult.count ?? 0;
  const currentUserId = sessionResult.data.user?.id ?? null;
  const completedBookings = (profile.completed_bookings_count as number) ?? 0;
  const isOwnProfile = currentUserId === profile.id;

  // Check if profile owner has blocked the viewer
  let isBlockedByProfile = false;
  if (currentUserId && !isOwnProfile) {
    const { data: blockData } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", profile.id)
      .eq("blocked_id", currentUserId)
      .maybeSingle();
    isBlockedByProfile = !!blockData;
  }

  if (isBlockedByProfile) {
    return (
      <main className="min-h-screen bg-zinc-950 pb-24">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
          <BackButton />
          <span className="text-sm font-semibold text-white">{profile.username}</span>
        </header>
        <div className="flex flex-col items-center justify-center gap-4 px-8 pt-32 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
            <ShieldBan size={28} className="text-zinc-500" />
          </div>
          <p className="text-[16px] font-semibold text-zinc-300">Profile unavailable</p>
          <p className="text-[13px] text-zinc-600 leading-relaxed">
            This profile is not available to you.
          </p>
        </div>
      </main>
    );
  }

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
    service_categories: (profile.service_categories as string[]) ?? [],
    hourly_rate: profile.hourly_rate as number | null,
  };

  const lastSeenStr = formatLastSeen((profile as Record<string, unknown>).last_seen_at as string | null ?? null);

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

        {/* City + age + Last Seen */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-500">
          {(profile.city || profile.age) && (
            <div className="flex items-center gap-1">
              {profile.city && <MapPin size={12} className="flex-shrink-0" />}
              <span className="text-[13px]">
                {[profile.city, profile.age ? `Age ${profile.age}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
          {lastSeenStr && (
            <div className="flex items-center gap-1">
              <Clock size={12} className="flex-shrink-0" />
              <span className={cn(
                "text-[13px]",
                lastSeenStr === "Online now" && "font-medium text-emerald-400"
              )}>
                {lastSeenStr}
              </span>
            </div>
          )}
        </div>

        {/* Completed bookings */}
        {USE_BOOKINGS && completedBookings > 0 && (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
              {completedBookings} completed
            </span>
          </div>
        )}

        {/* Short bio */}
        {profile.bio && !profile.bio_long && (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
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
            username={profile.username as string}
            initialIsFollowing={initialIsFollowing}
            userId={currentUserId}
            isOwnProfile={isOwnProfile}
            isProvider={profile.is_provider as boolean}
          />
          {!isOwnProfile && (
            <div className="mt-3 flex justify-center">
              <ReportButton targetType="profile" targetId={profile.id as string} />
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs: Posts / Listings / About / Reviews ── */}
      <ProfileTabs
        posts={posts}
        listings={listings as import("./ProfileTabs").ListingItem[]}
        attributes={attributes}
        isOwnProfile={isOwnProfile}
        isProvider={profile.is_provider as boolean}
      />

      {/* ── Sticky enquire bar (providers only) ── */}
      {(profile.is_provider as boolean) && (
        <EnquireBar
          username={profile.username as string}
          providerId={profile.id as string}
          isOwnProfile={isOwnProfile}
          contactWhatsapp={(profile as Record<string, unknown>).contact_whatsapp as string | null}
          contactTelegram={(profile as Record<string, unknown>).contact_telegram as string | null}
          contactPhone={(profile as Record<string, unknown>).contact_phone as string | null}
        />
      )}
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
