"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera, Search, MessageCircle, Inbox, Heart,
  Bell, Users, ShoppingBag, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  title: string;
  subtitle: string;
  ownTitle?: string;
  ownSubtitle?: string;
  cta?: { label: string; href: string };
  ownCta?: { label: string; href: string };
}> = {
  "no-posts": {
    icon: Camera,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    title: "No posts yet",
    subtitle: "This profile hasn't shared any posts yet.",
    ownTitle: "Share your first post",
    ownSubtitle: "Show off your best side — photos get you noticed.",
    ownCta: { label: "Create a post", href: "/profile/upload" },
  },
  "no-listings": {
    icon: ShoppingBag,
    iconColor: "text-pink-400",
    iconBg: "bg-pink-400/10 border-pink-400/20",
    title: "No listings yet",
    subtitle: "This provider hasn't added any services yet.",
    ownTitle: "Add your first listing",
    ownSubtitle: "Let clients know what you offer.",
    ownCta: { label: "Add a listing", href: "/profile/listings?new=1" },
  },
  "no-results": {
    icon: Search,
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-800 border-zinc-700",
    title: "No results found",
    subtitle: "Try adjusting your search or filters.",
  },
  "no-conversations": {
    icon: MessageCircle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    title: "No conversations yet",
    subtitle: "When a message request is accepted, your conversation will appear here.",
    cta: { label: "Explore profiles", href: "/explore" },
  },
  "no-requests": {
    icon: Inbox,
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-800 border-zinc-700",
    title: "No pending requests",
    subtitle: "Message requests from clients will appear here.",
  },
  "no-notifications": {
    icon: Bell,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    title: "All caught up",
    subtitle: "You'll be notified about likes, follows, and messages here.",
    cta: { label: "Explore profiles", href: "/explore" },
  },
  "no-followers": {
    icon: Users,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    title: "No followers yet",
    subtitle: "As you post and engage, followers will find you.",
    ownTitle: "Build your audience",
    ownSubtitle: "Share posts and stories to attract followers.",
    ownCta: { label: "Create a post", href: "/profile/upload" },
  },
  "no-favorites": {
    icon: Heart,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10 border-red-400/20",
    title: "No favorites yet",
    subtitle: "Follow profiles you love and their posts will appear here.",
    cta: { label: "Discover profiles", href: "/explore" },
  },
};

export function EmptyState({ variant, isOwnProfile = false, className }: Props) {
  const config = CONFIG[variant];
  const Icon = config.icon;
  const title = isOwnProfile && config.ownTitle ? config.ownTitle : config.title;
  const subtitle = isOwnProfile && config.ownSubtitle ? config.ownSubtitle : config.subtitle;
  const cta = isOwnProfile && config.ownCta ? config.ownCta : config.cta;

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
      {/* Animated icon container */}
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

      {cta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href={cta.href}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 active:scale-[0.97]"
          >
            <Sparkles size={14} />
            {cta.label}
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
