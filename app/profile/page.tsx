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
  Contrast,
  CreditCard,
  Wallet,
  Radio,
  Layers,
  Settings,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Shield,
  Eye,
  LogOut,
  Lock,
  ListOrdered,
  User,
  Users,
  Zap,
  Pencil,
  ImagePlus,
  CalendarCheck,
  ShieldBan,
  Globe,
  TrendingUp,
  Accessibility,
  Hand,
  Mic,
  Moon,
  Type,
  Vibrate,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { USE_BOOKINGS, USE_CREATOR_CONTENT, USE_LIVE_SHOWS } from "@/lib/features";
import { ScrollReveal } from "@/components/ui/AmbientEffects";
import { useAccessibility } from "@/contexts/AccessibilityContext";

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
    <p className="px-4 pb-2 pt-7 text-[12px] font-medium uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-2xl
    bg-white
    border border-gray-200
    divide-y divide-gray-100 shadow-md glow-card">
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

function Row({ icon: Icon, label, href, value, iconClassName = "text-slate-400" }: RowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-4 py-[14px]
      transition-all duration-150
      hover:bg-gray-50 active:scale-[0.98]"
    >
      <Icon size={18} className={cn("flex-shrink-0", iconClassName)} />
      <span className="flex-1 text-[15px] text-slate-700">{label}</span>
      {value && (
        <span className="text-[13px] text-slate-400 mr-0.5">{value}</span>
      )}
      <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
    </Link>
  );
}

type A11yQuickToggleProps = {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  iconClassName?: string;
};

function A11yQuickToggle({
  icon: Icon,
  label,
  checked,
  onChange,
  iconClassName = "text-slate-400",
}: A11yQuickToggleProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3.5 px-4 py-[14px] text-left transition-all duration-150 hover:bg-gray-50 active:scale-[0.98]"
    >
      <Icon size={18} className={cn("flex-shrink-0", iconClassName)} />
      <span className="flex-1 text-[15px] text-slate-700">{label}</span>
      <span className="sr-only">{checked ? t("a11y_on") : t("a11y_off")}</span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors",
          checked ? "bg-pink-400" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#fafbfc] animate-pulse">
      <div className="h-[57px] border-b border-gray-200 bg-[#fafbfc]" />
      <div className="flex flex-col items-center gap-3 pt-10 pb-6">
        <div className="h-20 w-20 rounded-full bg-gray-100" />
        <div className="h-4 w-28 rounded-full bg-gray-100" />
        <div className="h-3 w-36 rounded-full bg-gray-100" />
      </div>
      <div className="mx-4 h-[72px] rounded-2xl bg-gray-100" />
      <div className="mx-4 mt-8 h-[220px] rounded-2xl bg-gray-100" />
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ProviderPerformanceStrip({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [perfStats, setPerfStats] = useState<{
    profileViews: number;
    followers: number;
    posts: number;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;

    Promise.all([
      supabase
        .from("status_updates")
        .select("views_count")
        .eq("provider_id", userId)
        .eq("post_type", "post"),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),
    ]).then(([postsRes, followersRes]) => {
      const posts = postsRes.data ?? [];
      const totalViews = posts.reduce((s: number, p: { views_count: number }) => s + (p.views_count ?? 0), 0);
      setPerfStats({
        profileViews: totalViews,
        followers: followersRes.count ?? 0,
        posts: posts.length,
      });
    });
  }, [userId]);

  if (!perfStats) return null;

  const items = [
    { icon: Eye, label: t("perf_views"), value: formatCompact(perfStats.profileViews), color: "text-sky-400" },
    { icon: Users, label: t("perf_followers"), value: formatCompact(perfStats.followers), color: "text-violet-400" },
    { icon: TrendingUp, label: t("perf_posts"), value: formatCompact(perfStats.posts), color: "text-emerald-400" },
  ];

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md glow-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-pink-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            {t("perf_title")}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={cn("text-slate-300 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 py-3"
              >
                <Icon size={14} className={item.color} />
                <span className="text-[16px] font-bold text-slate-800 leading-none">{item.value}</span>
                <span className="text-[9px] font-medium text-slate-300">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { t, locale, setLocale } = useTranslation();
  const { prefs, setPref } = useAccessibility();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ following: 0, liked: 0, subscriptions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace("/auth/signin"); return; }

    async function load() {
      const [profileResult, followersResult, likedResult, subscriptionsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar_url, bio, is_provider, verification_status, is_private, followers_count, following_count, created_at")
          .eq("id", user!.id)
          .single(),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", user!.id),
        supabase
          .from("likes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id),
        supabase
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("subscriber_id", user!.id)
          .eq("status", "active"),
      ]);

      setProfile((profileResult.data as ProfileData) ?? null);
      setStats({
        following: followersResult.count ?? 0,
        liked: likedResult.count ?? 0,
        subscriptions: subscriptionsResult.count ?? 0,
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
    <div className="min-h-screen bg-[#fafbfc] pb-10 animate-[fadeIn_0.4s_ease-out]">
      <header className="sticky top-0 z-20 flex items-center justify-between
      border-b border-gray-200
      bg-white/90 px-5 py-[14px]
      backdrop-blur-xl backdrop-saturate-150">
        <span className="text-[17px] font-semibold text-slate-800">{t("nav_profile")}</span>
        <Link href="/profile/settings" aria-label="Settings" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-100 hover:text-slate-700">
          <Settings size={18} />
        </Link>
      </header>

      <div className="flex flex-col items-center px-4 pb-6 pt-8">
        <div className="relative mb-4 transition-transform duration-200 hover:scale-105">
          <div className="rounded-full p-[3px] bg-gradient-to-tr from-pink-400 via-sky-300 to-violet-400 shadow-[0_0_25px_rgba(244,114,182,0.25)]">
            <div className="rounded-full p-[2px] bg-white">
              {profile.avatar_url ? (
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full">
                  <Image src={profile.avatar_url} alt={profile.username} fill className="object-cover" sizes="76px" />
                </div>
              ) : (
                <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-slate-600">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <Link href="/profile/edit" aria-label="Edit profile" className="absolute bottom-0.5 right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-pink-400 text-white shadow-md">
            <Pencil size={11} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <h1 className="text-[20px] font-semibold text-slate-800 tracking-tight">{profile.username}</h1>
          {isVerified && <CheckCircle size={15} className="text-pink-500 fill-pink-50 drop-shadow" />}
          {profile.is_private && <Lock size={12} className="text-slate-300" />}
        </div>
        <p className="mt-1 text-[13px] text-slate-400">{t("profile_member_since")} {formatMemberSince(profile.created_at)}</p>
      </div>

      <div className="mx-4">
        <div className="flex items-center justify-around rounded-2xl
        bg-white
        border border-gray-200
        px-4 py-4 shadow-lg glow-card">
          {[
            { value: stats.following, label: t("profile_following") },
            { value: stats.liked, label: t("profile_liked") },
            { value: stats.subscriptions, label: t("profile_subscriptions") },
          ].map(({ value, label }, i, arr) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-[18px] font-semibold text-slate-800 tracking-tight tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400">
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && <div className="h-8 w-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {profile.is_provider && (
        <ProviderPerformanceStrip userId={profile.id} />
      )}

      {profile.is_provider && (
        <ScrollReveal>
          <SectionLabel>{t("profile_section_provider")}</SectionLabel>
          <ListCard>
            <Row icon={ListOrdered}   label={t("profile_my_listings")}      href="/profile/listings"        iconClassName="text-pink-500" />
            {USE_BOOKINGS && (
              <Row icon={CalendarCheck} label={t("nav_bookings")}           href="/profile/bookings"        iconClassName="text-sky-400" />
            )}
            <Row icon={User}          label={t("profile_my_page")}          href={`/u/${profile.username}`} iconClassName="text-violet-400" />
            <Row icon={Zap}           label={t("profile_availability")}     href="/profile/availability"    iconClassName="text-emerald-400" />
            <Row icon={Crown}         label={t("profile_subscription_tier")}href="/profile/subscription"    iconClassName="text-pink-500" />
            {USE_CREATOR_CONTENT && (
              <Row icon={Wallet}      label={t("profile_earnings")}         href="/profile/earnings"        iconClassName="text-emerald-500" />
            )}
            {USE_LIVE_SHOWS && (
              <Row icon={Radio}       label={t("profile_live_shows")}       href="/live"                    iconClassName="text-red-500" />
            )}
            <Row icon={MessageCircle} label={t("profile_comment_mod")}       href="/profile/comments"        iconClassName="text-emerald-400" />
            <Row icon={ImagePlus}     label={t("profile_upload_post")}      href="/profile/upload"          iconClassName="text-sky-400" />
          </ListCard>
        </ScrollReveal>
      )}

      <ScrollReveal delay={100}>
        <SectionLabel>{t("profile_section_activity")}</SectionLabel>
        <ListCard>
          {USE_BOOKINGS && (
            <Row icon={CalendarCheck} label={t("bookings_title")}     href="/bookings"             iconClassName="text-pink-500" />
          )}
          <Row icon={Bookmark}      label={t("profile_saved")}          href="/profile/liked"        iconClassName="text-rose-400" />
          <Row icon={Crown}         label={t("profile_subscriptions")}href="/profile/subscriptions"iconClassName="text-pink-500" />
          {USE_CREATOR_CONTENT && (
            <Row icon={Layers}      label={t("profile_bundles")}        href="/bundles"              iconClassName="text-violet-500" />
          )}
          <Row icon={MessageCircle} label={t("profile_messages")}     href="/messages"             iconClassName="text-emerald-400" />
        </ListCard>
      </ScrollReveal>

      <ScrollReveal delay={200}>
        <SectionLabel>{t("profile_section_account")}</SectionLabel>
        <ListCard>
        <Row icon={Pencil}     label={t("profile_edit")}             href="/profile/edit"          iconClassName="text-pink-500" />
        <Row icon={Eye}        label={t("profile_privacy")}          href="/profile/privacy"       value={profile.is_private ? t("profile_private") : t("profile_public")} />
        {profile.is_provider && (
          <Row icon={Shield}   label={t("profile_id_verification")}  href="/profile/verify"        value={isVerified ? t("profile_verified") : t("profile_not_verified")} iconClassName={isVerified ? "text-pink-500" : "text-slate-400"} />
        )}
        <Row icon={Bell}       label={t("profile_notifications")}    href="/profile/notifications" />
        {profile.is_provider && (
          <Row icon={CreditCard} label={t("profile_billing")}        href="/profile/billing" />
        )}
        {profile.is_provider && (
          <Row icon={ShieldBan}  label={t("profile_blocked")}         href="/profile/blocked" />
        )}
        <Row icon={Settings}   label={t("profile_account_settings")} href="/profile/settings" />
        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === "en" ? "fr" : "en")}
          className="flex w-full items-center gap-3.5 px-4 py-[14px] transition-all duration-150 hover:bg-gray-50 active:scale-[0.98]"
        >
          <Globe size={18} className="flex-shrink-0 text-slate-400" />
          <span className="flex-1 text-left text-[15px] text-slate-700">{t("profile_language")}</span>
          <span className="text-[13px] text-slate-400 mr-0.5">
            {locale === "en" ? "English" : "Fran\u00e7ais"}
          </span>
          <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
        </button>
        </ListCard>
      </ScrollReveal>

      <ScrollReveal delay={250}>
        <SectionLabel>{t("a11y_profile_label")}</SectionLabel>
        <ListCard>
          <A11yQuickToggle
            icon={Moon}
            label={t("a11y_dark_mode")}
            checked={prefs.theme === "dark"}
            onChange={(checked) => setPref("theme", checked ? "dark" : "light")}
            iconClassName="text-violet-400"
          />
          <A11yQuickToggle
            icon={Contrast}
            label={t("a11y_high_contrast")}
            checked={prefs.highContrast}
            onChange={(checked) => setPref("highContrast", checked)}
            iconClassName="text-slate-500"
          />
          <A11yQuickToggle
            icon={ZapOff}
            label={t("a11y_reduce_motion")}
            checked={prefs.reduceMotion}
            onChange={(checked) => setPref("reduceMotion", checked)}
            iconClassName="text-emerald-400"
          />
          <A11yQuickToggle
            icon={Hand}
            label={t("a11y_large_targets")}
            checked={prefs.largeTargets}
            onChange={(checked) => setPref("largeTargets", checked)}
            iconClassName="text-sky-400"
          />
          <A11yQuickToggle
            icon={Mic}
            label={t("a11y_voice_controls")}
            checked={prefs.voiceControls}
            onChange={(checked) => setPref("voiceControls", checked)}
            iconClassName="text-pink-500"
          />
          <A11yQuickToggle
            icon={Vibrate}
            label={t("a11y_haptics")}
            checked={prefs.haptics}
            onChange={(checked) => setPref("haptics", checked)}
            iconClassName="text-amber-500"
          />
          <Row
            icon={Type}
            label={`${t("a11y_text_size")} / ${t("a11y_page_zoom")}`}
            href="/profile/accessibility"
            value={`${prefs.textScale}%`}
            iconClassName="text-sky-400"
          />
          <Row
            icon={Accessibility}
            label={t("a11y_screen_reader")}
            href="/profile/accessibility"
            value={t("view_details")}
            iconClassName="text-violet-400"
          />
        </ListCard>
      </ScrollReveal>

      <ScrollReveal delay={300}>
        <div className="mx-4 mt-8 overflow-hidden rounded-2xl
        bg-white
        border border-red-200">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3.5 px-4 py-[14px]
            transition-all duration-150
            hover:bg-red-50 active:scale-[0.98]"
          >
            <LogOut size={18} className="flex-shrink-0 text-red-500" />
            <span className="text-[15px] font-medium text-red-500">{t("sign_out")}</span>
          </button>
        </div>
      </ScrollReveal>
    </div>
  );
}
