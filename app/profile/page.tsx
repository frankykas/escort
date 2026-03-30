"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Bookmark,
  Crown,
  MessageCircle,
  Bell,
  CreditCard,
  Settings,
  ChevronRight,
  CheckCircle,
  Shield,
  Eye,
  LogOut,
  Lock,
  ListOrdered,
  User,
  Zap,
  Pencil,
  ImagePlus,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { USE_BOOKINGS } from "@/lib/features";

type ProfileData = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_provider: boolean;
  verification_status: "none" | "pending" | "verified";
  is_private: boolean;
  followers_count: number;
  following_count: number;
  created_at: string;
};

type Stats = { following: number; liked: number; subscriptions: number };

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-2 pt-7 text-[12px] font-medium uppercase tracking-widest text-zinc-400">
      {children}
    </p>
  );
}

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-2xl
    bg-gradient-to-b from-zinc-900 to-zinc-950
    border border-white/5
    divide-y divide-white/5 shadow-md">
      {children}
    </div>
  );
}

type RowProps = {
  icon: React.ElementType;
  label: string;
  href: string;
  value?: string;
  iconClassName?: string;
};

function Row({ icon: Icon, label, href, value, iconClassName = "text-zinc-500" }: RowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-4 py-[14px]
      transition-all duration-150
      hover:bg-white/5 active:scale-[0.98]"
    >
      <Icon size={18} className={cn("flex-shrink-0", iconClassName)} />
      <span className="flex-1 text-[15px] text-zinc-100">{label}</span>
      {value && (
        <span className="text-[13px] text-zinc-500 mr-0.5">{value}</span>
      )}
      <ChevronRight size={15} className="flex-shrink-0 text-zinc-600" />
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-[57px] border-b border-zinc-900 bg-zinc-950" />
      <div className="flex flex-col items-center gap-3 pt-10 pb-6">
        <div className="h-20 w-20 rounded-full bg-zinc-800" />
        <div className="h-4 w-28 rounded-full bg-zinc-800" />
        <div className="h-3 w-36 rounded-full bg-zinc-800/60" />
      </div>
      <div className="mx-4 h-[72px] rounded-2xl bg-zinc-900" />
      <div className="mx-4 mt-8 h-[220px] rounded-2xl bg-zinc-900" />
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ following: 0, liked: 0, subscriptions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace("/auth/signin"); return; }

    async function load() {
      const [profileResult, followingResult, likedResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar_url, bio, is_provider, verification_status, is_private, followers_count, following_count, created_at")
          .eq("id", user!.id)
          .single(),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", user!.id),
        supabase
          .from("likes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id),
      ]);

      setProfile((profileResult.data as ProfileData) ?? null);
      setStats({
        following: followingResult.count ?? 0,
        liked: likedResult.count ?? 0,
        subscriptions: 0,
      });
      setLoading(false);
    }

    load();
  }, [user, sessionLoading, router]);

  if (sessionLoading || loading) return <Skeleton />;
  if (!profile) return null;

  const isVerified = profile.verification_status === "verified";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black pb-10 animate-[fadeIn_0.4s_ease-out]">
      <header className="sticky top-0 z-20 flex items-center justify-between
      border-b border-white/5
      bg-zinc-950/70 px-5 py-[14px]
      backdrop-blur-xl backdrop-saturate-150">
        <span className="text-[17px] font-semibold text-white">Profile</span>
        <Link href="/profile/settings" aria-label="Settings" className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <Settings size={18} />
        </Link>
      </header>

      <div className="flex flex-col items-center px-4 pb-6 pt-8">
        <div className="relative mb-4 transition-transform duration-200 hover:scale-105">
          <div className="rounded-full p-[3px] bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-400 shadow-[0_0_25px_rgba(251,191,36,0.25)]">
            <div className="rounded-full p-[2px] bg-zinc-950">
              {profile.avatar_url ? (
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full">
                  <Image src={profile.avatar_url} alt={profile.username} fill className="object-cover" sizes="76px" />
                </div>
              ) : (
                <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold text-zinc-300">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <Link href="/profile/edit" aria-label="Edit profile" className="absolute bottom-0.5 right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-amber-400 text-black shadow-md">
            <Pencil size={11} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <h1 className="text-[20px] font-semibold text-white tracking-tight">{profile.username}</h1>
          {isVerified && <CheckCircle size={15} className="text-amber-400 fill-amber-400/20 drop-shadow" />}
          {profile.is_private && <Lock size={12} className="text-zinc-600" />}
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">{t("profile_member_since")} {formatMemberSince(profile.created_at)}</p>
      </div>

      <div className="mx-4">
        <div className="flex items-center justify-around rounded-2xl
        bg-gradient-to-b from-zinc-900 to-zinc-950
        border border-white/5
        px-4 py-4 shadow-lg">
          {[
            { value: stats.following, label: t("profile_following") },
            { value: stats.liked, label: t("profile_liked") },
            { value: stats.subscriptions, label: t("profile_subscriptions") },
          ].map(({ value, label }, i, arr) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-[18px] font-semibold text-white tracking-tight tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && <div className="h-8 w-px bg-white/5" />}
            </div>
          ))}
        </div>
      </div>

      {profile.is_provider && (
        <>
          <SectionLabel>{t("profile_section_provider")}</SectionLabel>
          <ListCard>
            <Row icon={ListOrdered}   label={t("profile_my_listings")}      href="/profile/listings"        iconClassName="text-amber-400" />
            {USE_BOOKINGS && (
              <Row icon={CalendarCheck} label={t("nav_bookings")}           href="/profile/bookings"        iconClassName="text-sky-400" />
            )}
            <Row icon={User}          label={t("profile_my_page")}          href={`/u/${profile.username}`} iconClassName="text-violet-400" />
            <Row icon={Zap}           label={t("profile_availability")}     href="/profile/availability"    iconClassName="text-emerald-400" />
            <Row icon={Crown}         label={t("profile_subscription_tier")}href="/profile/subscription"    iconClassName="text-amber-400" />
            <Row icon={MessageCircle} label="Comment Moderation"            href="/profile/comments"        iconClassName="text-emerald-400" />
            <Row icon={ImagePlus}     label={t("profile_upload_post")}      href="/profile/upload"          iconClassName="text-sky-400" />
          </ListCard>
        </>
      )}

      <SectionLabel>{t("profile_section_activity")}</SectionLabel>
      <ListCard>
        {USE_BOOKINGS && (
          <Row icon={CalendarCheck} label={t("bookings_title")}     href="/bookings"             iconClassName="text-amber-400" />
        )}
        <Row icon={Heart}         label={t("profile_favorites")}    href="/?tab=favorites"       iconClassName="text-rose-400" />
        <Row icon={Bookmark}      label={t("profile_liked_posts")}  href="/profile/liked"        iconClassName="text-sky-400" />
        <Row icon={Crown}         label={t("profile_subscriptions")}href="/profile/subscriptions"iconClassName="text-amber-400" />
        <Row icon={MessageCircle} label={t("profile_messages")}     href="/messages"             iconClassName="text-emerald-400" />
      </ListCard>

      <SectionLabel>{t("profile_section_account")}</SectionLabel>
      <ListCard>
        <Row icon={Pencil}     label={t("profile_edit")}             href="/profile/edit"          iconClassName="text-amber-400" />
        <Row icon={Eye}        label={t("profile_privacy")}          href="/profile/privacy"       value={profile.is_private ? t("profile_private") : t("profile_public")} />
        <Row icon={Shield}     label={t("profile_id_verification")}  href="/profile/verify"        value={isVerified ? t("profile_verified") : t("profile_not_verified")} iconClassName={isVerified ? "text-amber-400" : "text-zinc-500"} />
        <Row icon={Bell}       label={t("profile_notifications")}    href="/profile/notifications" />
        <Row icon={CreditCard} label={t("profile_billing")}          href="/profile/billing" />
        <Row icon={Settings}   label={t("profile_account_settings")} href="/profile/settings" />
      </ListCard>

      <div className="mx-4 mt-8 overflow-hidden rounded-2xl
      bg-gradient-to-b from-zinc-900 to-zinc-950
      border border-red-500/10">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3.5 px-4 py-[14px]
          transition-all duration-150
          hover:bg-red-500/10 active:scale-[0.98]"
        >
          <LogOut size={18} className="flex-shrink-0 text-red-500" />
          <span className="text-[15px] font-medium text-red-500">{t("sign_out")}</span>
        </button>
      </div>
    </div>
  );
}
