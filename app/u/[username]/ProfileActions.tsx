"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Crown, Clock, Pencil, BarChart3, Share2, Check,
  MessageCircle, ChevronDown, UserMinus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFollow } from "@/hooks/useFollow";
import { useRequestStatus } from "@/hooks/useMessageRequests";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";

type Props = {
  profileId: string;
  username: string;
  initialIsFollowing: boolean;
  userId: string | null;
  isOwnProfile: boolean;
  isProvider: boolean;
};

export function ProfileActions({
  profileId, username, initialIsFollowing, userId: _serverUserId, isOwnProfile, isProvider,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: sessionLoading } = useSession();
  const { promptIfGuest, modal: signupModal } = useSignupPrompt();

  // Always use client-side user ID — server-side is unreliable
  const clientUserId = user?.id ?? null;

  // Client-side follow state — fetch real state once we have a user
  const [realFollowState, setRealFollowState] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clientUserId || clientUserId === profileId) return;

    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", clientUserId)
      .eq("following_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        setRealFollowState(!!data);
      });
  }, [clientUserId, profileId]);

  const { isFollowing, toggle } = useFollow({
    profileId,
    initialIsFollowing: realFollowState ?? initialIsFollowing,
    userId: clientUserId,
  });

  const { status: requestStatus, loading: statusLoading } = useRequestStatus(
    clientUserId,
    profileId
  );

  const [hasSubscriptionTier, setHasSubscriptionTier] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followMenuOpen, setFollowMenuOpen] = useState(false);

  // Client-side ownership check
  const isOwn = isOwnProfile || (clientUserId === profileId);

  // Check subscription state
  useEffect(() => {
    if (!isProvider || isOwn) return;

    supabase
      .from("subscription_tiers")
      .select("id, monthly_rate")
      .eq("provider_id", profileId)
      .eq("is_active", true)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setHasSubscriptionTier(true);
      });

    if (clientUserId) {
      supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", clientUserId)
        .eq("provider_id", profileId)
        .eq("is_active", true)
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) setIsSubscribed(true);
        });
    }
  }, [profileId, clientUserId, isProvider, isOwn]);

  // ── Own profile: Edit + Analytics + Share ──
  if (isOwn) {
    async function handleShare() {
      const url = `${window.location.origin}/u/${username}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: `@${username}`, url });
        } else {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch {
        // User cancelled share sheet
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/profile/edit")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            <Pencil size={14} />
            {t("pa_edit_profile")}
          </button>
          {isProvider && (
            <button
              onClick={() => router.push("/profile/analytics")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <BarChart3 size={14} />
              {t("pa_analytics")}
            </button>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-400">{t("pa_link_copied")}</span>
            </>
          ) : (
            <>
              <Share2 size={14} />
              {t("pa_share_profile")}
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Other user's profile ──
  function handleFollow() {
    if (promptIfGuest("follow")) return;
    if (isFollowing) {
      // Open dropdown instead of toggling directly
      setFollowMenuOpen(true);
      return;
    }
    toggle();
  }

  function handleUnfollow() {
    setFollowMenuOpen(false);
    toggle();
  }

  function handleMessage() {
    if (promptIfGuest("message")) return;

    if (requestStatus === "accepted") {
      router.push(`/messages/${username}`);
    }
    // For pending or no request — the EnquireBar at the bottom handles the flow
    if (requestStatus === "none" || requestStatus === "pending") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  async function handleSubscribe() {
    if (promptIfGuest("subscribe")) return;
    if (isSubscribed) return;

    setSubLoading(true);
    const { error } = await supabase.from("subscriptions").insert({
      subscriber_id: clientUserId,
      provider_id: profileId,
    });
    setSubLoading(false);

    if (!error) setIsSubscribed(true);
  }

  const isPending = requestStatus === "pending";
  const isAccepted = requestStatus === "accepted";

  const messageLabel = statusLoading
    ? t("pa_message")
    : isAccepted
      ? t("pa_message")
      : isPending
        ? t("pa_pending")
        : t("pa_message");

  const messageIcon = isPending
    ? Clock
    : MessageCircle;

  const MessageIcon = messageIcon;

  return (
    <div className="space-y-2">
      {signupModal}
      <div className="flex gap-2">
        {/* Follow / Following button with dropdown */}
        <div className="relative flex-1">
          <motion.button
            onClick={handleFollow}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
              isFollowing
                ? "border border-zinc-700 bg-transparent text-zinc-400"
                : "bg-white text-zinc-950 hover:bg-zinc-200"
            )}
          >
            {isFollowing ? t("post_following") : t("post_follow")}
            {isFollowing && <ChevronDown size={13} className="text-zinc-500" />}
          </motion.button>

          {/* Unfollow dropdown */}
          <AnimatePresence>
            {followMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFollowMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl"
                >
                  <button
                    onClick={handleUnfollow}
                    className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-red-400 transition hover:bg-zinc-800"
                  >
                    <UserMinus size={14} />
                    {t("pa_unfollow_user").replace("{username}", username)}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Message button */}
        <motion.button
          onClick={handleMessage}
          disabled={isPending}
          whileTap={isPending ? undefined : { scale: 0.93 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
            isPending
              ? "border border-zinc-700 text-zinc-500 cursor-not-allowed"
              : isAccepted
                ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                : "border border-zinc-700 text-white hover:bg-zinc-800"
          )}
        >
          <MessageIcon size={14} />
          {messageLabel}
        </motion.button>
      </div>

      {/* Subscribe button — only for providers with a subscription tier */}
      {hasSubscriptionTier && (
        <motion.button
          onClick={handleSubscribe}
          disabled={isSubscribed || subLoading}
          whileTap={isSubscribed ? undefined : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all",
            isSubscribed
              ? "border border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 hover:from-amber-300 hover:to-amber-400"
          )}
        >
          <Crown size={15} strokeWidth={2.5} />
          {isSubscribed ? t("pa_subscribed") : subLoading ? t("pa_subscribing") : t("pa_subscribe")}
        </motion.button>
      )}
    </div>
  );
}
