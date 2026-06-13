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
import { SimilarProfiles } from "./SimilarProfiles";
import { EditProfileLink } from "./EditProfileLink";
import {
  TrustSignals,
  SocialProofStrip,
  AvailabilitySpotlight,
  ShareStrip,
} from "./ProfileSections";
import { ProfileCategoryStrip } from "./ProfileCategoryStrip";
import { ActivityIndicator } from "@/components/ui/ActivityIndicator";
import { USE_BOOKINGS } from "@/lib/features";
import { cn, formatLastSeen } from "@/lib/utils";
import { getServerT } from "@/lib/i18n";
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
  const t = await getServerT();
  const supabase = createServerClient();

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafbfc]">
        <p className="text-sm text-slate-400">Supabase not configured.</p>
      </main>
    );
  }

  // Fetch profile with all attribute columns
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `id, username, avatar_url, bio, bio_long, verification_status, is_provider, provider_type,
       city, country_code, incall, outcall, age, available_until,
       height_cm, build, hair_color, eye_color, nationality, languages,
       completed_bookings_count,
       service_categories, hourly_rate,
       contact_whatsapp, contact_telegram, contact_phone,
       website_url, tiktok_url, snapchat_url, instagram_url, onlyfans_url, twitter_url, facebook_url,
       show_contact_details, show_social_links, hip_size, bust_size, bra_cup_size,
       gender, pronouns, caters_to, availability_schedule, tagline,
       created_at, last_seen_at`
    )
    .eq("username", username)
    .single();

  if (profileError || !profile) notFound();

  // Parallel fetches
  const [postsResult, listingsResult, followersResult, followingResult, sessionResult] =
    await Promise.all([
      supabase
        .from("status_updates")
        .select("id, media_url, blur_url, is_premium, likes_count, comments_count")
        .eq("provider_id", profile.id)
        .eq("post_type", "post")
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
      <main className="min-h-screen bg-[#fafbfc] pb-24">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
          <BackButton />
          <span className="text-sm font-semibold text-slate-800">{profile.username}</span>
        </header>
        <div className="flex flex-col items-center justify-center gap-4 px-8 pt-32 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <ShieldBan size={28} className="text-slate-400" />
          </div>
          <p className="text-[16px] font-semibold text-slate-600">Profile unavailable</p>
          <p className="text-[13px] text-slate-300 leading-relaxed">
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
    gender: profile.gender as string | null,
    pronouns: profile.pronouns as string | null,
    caters_to: (profile.caters_to as string[]) ?? [],
    availability_schedule: profile.availability_schedule as Record<string, string> | null,
    hip_size: (profile as Record<string, unknown>).hip_size as string | null,
    bust_size: (profile as Record<string, unknown>).bust_size as string | null,
    bra_cup_size: (profile as Record<string, unknown>).bra_cup_size as string | null,
    contact_phone: profile.show_contact_details === false ? null : (profile as Record<string, unknown>).contact_phone as string | null,
    website_url: profile.show_contact_details === false ? null : (profile as Record<string, unknown>).website_url as string | null,
    social_links: profile.show_social_links === false ? {} : {
      TikTok: (profile as Record<string, unknown>).tiktok_url as string | null,
      Snapchat: (profile as Record<string, unknown>).snapchat_url as string | null,
      Instagram: (profile as Record<string, unknown>).instagram_url as string | null,
      OnlyFans: (profile as Record<string, unknown>).onlyfans_url as string | null,
      "Twitter/X": (profile as Record<string, unknown>).twitter_url as string | null,
      Facebook: (profile as Record<string, unknown>).facebook_url as string | null,
    },
  };

  const lastSeenStr = formatLastSeen((profile as Record<string, unknown>).last_seen_at as string | null ?? null);

  return (
    <main className={cn("min-h-screen bg-[#fafbfc]", !isOwnProfile && profile.provider_type === "escort" ? "pb-44" : "pb-24")}>
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        <BackButton />
        <span className="text-sm font-semibold text-slate-800">{profile.username}</span>
        {isVerified && (
          <CheckCircle size={13} className="fill-pink-100 text-pink-500" />
        )}
        <div className="ml-auto">
          <EditProfileLink profileId={profile.id as string} />
        </div>
      </header>

      {/* ── Hero photo carousel ── */}
      <HeroCarousel photos={photos} username={profile.username as string} />

      {/* ── Profile info ── */}
      <div className="relative z-10 -mt-20 px-4 pb-0">
        {/* Avatar */}
        <div className="inline-block rounded-full bg-gradient-to-tr from-pink-400 via-sky-300 to-violet-400 p-[3px] shadow-[0_0_20px_rgba(244,114,182,0.2)]">
          <div className="rounded-full bg-white p-[2px]">
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
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-slate-600">
                {(profile.username as string)[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name + verified + available */}
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">{profile.username as string}</h1>
          {isVerified && (
            <CheckCircle size={16} className="flex-shrink-0 fill-pink-100 text-pink-500" />
          )}
          {available && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">Available</span>
            </span>
          )}
        </div>

        {/* Tagline */}
        {profile.tagline && (
          <p className="mt-1 text-[13px] italic text-slate-500">
            {profile.tagline as string}
          </p>
        )}

        {/* City + age + Last Seen */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
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
          <ActivityIndicator lastSeenAt={(profile as Record<string, unknown>).last_seen_at as string | null} availableUntil={profile.available_until as string | null} />
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
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            {profile.bio as string}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6">
          <StatItem value={formatCount(posts.length)} label={t("pub_posts")} />
          <div className="h-8 w-px bg-gray-200" />
          <StatItem value={formatCount(followersCount)} label={t("pub_followers")} />
          <div className="h-8 w-px bg-gray-200" />
          <StatItem value={formatCount(followingCount)} label={t("profile_following")} />
          {listings.length > 0 && (
            <>
              <div className="h-8 w-px bg-gray-200" />
              <StatItem value={formatCount(listings.length)} label={t("pub_listings")} />
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
            isProvider={profile.provider_type != null}
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
        isProvider={profile.provider_type === "escort"}
      />

      {/* ── Profile sections (escorts only) ── */}
      {!isOwnProfile && profile.provider_type === "escort" && (
        <>
          {/* Availability spotlight — today's hours */}
          <AvailabilitySpotlight
            schedule={profile.availability_schedule as Record<string, string> | null}
            availableUntil={profile.available_until as string | null}
          />

          {/* Trust & Safety signals */}
          <TrustSignals
            isVerified={(profile.verification_status as string) === "verified"}
            memberSince={profile.created_at as string | null}
            lastSeenAt={(profile as Record<string, unknown>).last_seen_at as string | null}
          />

          {/* Social proof strip */}
          <SocialProofStrip
            followersCount={followersCount}
            postsCount={posts.length}
            memberSince={profile.created_at as string | null}
            lastSeenAt={(profile as Record<string, unknown>).last_seen_at as string | null}
          />

          {/* Similar profiles */}
          <SimilarProfiles
            profileId={profile.id as string}
            city={profile.city as string | null}
            serviceCategories={(profile.service_categories as string[]) ?? []}
          />

          {/* Share strip */}
          <ShareStrip username={profile.username as string} />

          {/* Browse by category */}
          <ProfileCategoryStrip
            serviceCategories={(profile.service_categories as string[]) ?? []}
          />
        </>
      )}

      {/* ── Sticky enquire bar (escorts only — never on own profile) ── */}
      {!isOwnProfile && profile.provider_type === "escort" && (
        <EnquireBar
          username={profile.username as string}
          providerId={profile.id as string}
          isOwnProfile={false}
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
      <span className="text-[15px] font-bold text-slate-800">{value}</span>
      <span className="mt-0.5 text-[11px] text-slate-400">{label}</span>
    </div>
  );
}
