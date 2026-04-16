"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera, Search, MessageCircle, Inbox, Heart,
  Bell, Users, ShoppingBag, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

type Variant =
  | "no-posts"
  | "no-listings"
  | "no-results"
  | "no-conversations"
  | "no-requests"
  | "no-notifications"
  | "no-followers"
  | "no-favorites";

type Props = {
  variant: Variant;
  isOwnProfile?: boolean;
  className?: string;
};

const CONFIG: Record<Variant, {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  titleKey: TranslationKey;
  subKey: TranslationKey;
  ownTitleKey?: TranslationKey;
  ownSubKey?: TranslationKey;
  cta?: { labelKey: TranslationKey; href: string };
  ownCta?: { labelKey: TranslationKey; href: string };
}> = {
  "no-posts": {
    icon: Camera,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    titleKey: "empty_no_posts_title",
    subKey: "empty_no_posts_sub",
    ownTitleKey: "empty_no_posts_own_title",
    ownSubKey: "empty_no_posts_own_sub",
    ownCta: { labelKey: "empty_no_posts_own_cta", href: "/profile/upload" },
  },
  "no-listings": {
    icon: ShoppingBag,
    iconColor: "text-pink-400",
    iconBg: "bg-pink-400/10 border-pink-400/20",
    titleKey: "empty_no_listings_title",
    subKey: "empty_no_listings_sub",
    ownTitleKey: "empty_no_listings_own_title",
    ownSubKey: "empty_no_listings_own_sub",
    ownCta: { labelKey: "empty_no_listings_own_cta", href: "/profile/listings?new=1" },
  },
  "no-results": {
    icon: Search,
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-800 border-zinc-700",
    titleKey: "empty_no_results_title",
    subKey: "empty_no_results_sub",
  },
  "no-conversations": {
    icon: MessageCircle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    titleKey: "empty_no_conversations_title",
    subKey: "empty_no_conversations_sub",
    cta: { labelKey: "empty_no_conversations_cta", href: "/explore" },
  },
  "no-requests": {
    icon: Inbox,
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-800 border-zinc-700",
    titleKey: "empty_no_requests_title",
    subKey: "empty_no_requests_sub",
  },
  "no-notifications": {
    icon: Bell,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    titleKey: "empty_no_notifications_title",
    subKey: "empty_no_notifications_sub",
    cta: { labelKey: "empty_no_notifications_cta", href: "/explore" },
  },
  "no-followers": {
    icon: Users,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    titleKey: "empty_no_followers_title",
    subKey: "empty_no_followers_sub",
    ownTitleKey: "empty_no_followers_own_title",
    ownSubKey: "empty_no_followers_own_sub",
    ownCta: { labelKey: "empty_no_followers_own_cta", href: "/profile/upload" },
  },
  "no-favorites": {
    icon: Heart,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10 border-red-400/20",
    titleKey: "empty_no_favorites_title",
    subKey: "empty_no_favorites_sub",
    cta: { labelKey: "empty_no_favorites_cta", href: "/explore" },
  },
};

export function EmptyState({ variant, isOwnProfile = false, className }: Props) {
  const { t } = useTranslation();
  const config = CONFIG[variant];
  const Icon = config.icon;
  const title = t(isOwnProfile && config.ownTitleKey ? config.ownTitleKey : config.titleKey);
  const subtitle = t(isOwnProfile && config.ownSubKey ? config.ownSubKey : config.subKey);
  const ctaConfig = isOwnProfile && config.ownCta ? config.ownCta : config.cta;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-8 py-16 text-center",
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-3xl border",
          config.iconBg
        )}
      >
        <Icon size={32} className={config.iconColor} />
      </motion.div>

      <div className="space-y-2">
        <p className="text-[16px] font-semibold text-white">{title}</p>
        <p className="text-[13px] leading-relaxed text-zinc-500 max-w-[260px]">
          {subtitle}
        </p>
      </div>

      {ctaConfig && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href={ctaConfig.href}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 active:scale-[0.97]"
          >
            <Sparkles size={14} />
            {t(ctaConfig.labelKey)}
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
