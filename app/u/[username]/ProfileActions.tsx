"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Crown, Clock, Pencil, BarChart3, Share2, Check,
  MessageCircle, ChevronDown, UserMinus, Heart, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFollow } from "@/hooks/useFollow";
import { useRequestStatus } from "@/hooks/useMessageRequests";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";
import { USE_CREATOR_CONTENT } from "@/lib/features";
import { apiFetch } from "@/lib/api-fetch";
import TipSheet from "@/components/creator/TipSheet";

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
  const [tierId, setTierId] = useState<string | null>(null);
  const [monthlyRate, setMonthlyRate] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followMenuOpen, setFollowMenuOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        if (data) {
          setHasSubscriptionTier(true);
          setTierId(data.id);
          setMonthlyRate(data.monthly_rate ?? 0);
        }
      });

    if (clientUserId) {
      supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", clientUserId)
        .eq("provider_id", profileId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-gray-100"
          >
            <Pencil size={14} />
            {t("pa_edit_profile")}
          </button>
          {isProvider && (
            <button
              onClick={() => router.push("/profile/analytics")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-gray-100"
            >
              <BarChart3 size={14} />
              {t("pa_analytics")}
            </button>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
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

    // Paid subscriptions: hand off to the PayRam checkout when the creator
    // layer is enabled and the tier has a price.
    if (USE_CREATOR_CONTENT && tierId && monthlyRate > 0) {
      setSubLoading(true);
      setActionError(null);
      try {
        const res = await apiFetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "subscription", referenceId: tierId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url as string;
          return;
        }
        setActionError(data.error ?? "Could not start subscription.");
      } catch {
        setActionError("Network error. Please try again.");
      } finally {
        setSubLoading(false);
      }
      return;
    }

    // Free subscription (tier priced at 0) or creator layer off: create the
    // subscription directly, no payment. Upsert so re-subscribing after a cancel
    // reactivates the existing row.
    setSubLoading(true);
    const { error } = await supabase.from("subscriptions").upsert(
      {
        subscriber_id: clientUserId,
        provider_id: profileId,
        tier_id: tierId,
        status: "active",
      },
      { onConflict: "subscriber_id,provider_id" }
    );
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
                ? "border border-gray-200 bg-white text-slate-500"
                : "bg-pink-400 text-white hover:bg-pink-300"
            )}
          >
            {isFollowing ? t("post_following") : t("post_follow")}
            {isFollowing && <ChevronDown size={13} className="text-slate-400" />}
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
                  className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                >
                  <button
                    onClick={handleUnfollow}
                    className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-red-400 transition hover:bg-gray-100"
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
              ? "border border-gray-200 text-slate-400 cursor-not-allowed"
              : isAccepted
                ? "bg-sky-400 text-white hover:bg-sky-300"
                : "border border-gray-200 text-slate-800 hover:bg-gray-100"
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
              ? "border border-pink-300 bg-pink-50 text-pink-500"
              : "bg-[rgb(246,51,154)] text-white hover:brightness-105"
          )}
        >
          {subLoading ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} strokeWidth={2.5} />}
          {isSubscribed
            ? t("pa_subscribed")
            : subLoading
              ? t("pa_subscribing")
              : USE_CREATOR_CONTENT && monthlyRate > 0
                ? `${t("pa_subscribe")} · CA$${Math.round(monthlyRate / 100)}/mo`
                : USE_CREATOR_CONTENT && hasSubscriptionTier
                  ? `${t("pa_subscribe")} · Free`
                  : t("pa_subscribe")}
        </motion.button>
      )}

      {/* Tip button — creator layer only */}
      {USE_CREATOR_CONTENT && isProvider && (
        <button
          onClick={() => { if (!promptIfGuest("subscribe")) setTipOpen(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-pink-200 bg-white py-2.5 text-sm font-semibold text-pink-500 transition-colors hover:bg-pink-50"
        >
          <Heart size={15} strokeWidth={2.5} />
          {t("pa_send_tip")}
        </button>
      )}

      {actionError && (
        <p className="text-center text-[12px] text-red-500">{actionError}</p>
      )}

      {USE_CREATOR_CONTENT && (
        <TipSheet
          creatorId={profileId}
          creatorName={username}
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          onError={(msg) => { setTipOpen(false); setActionError(msg); }}
        />
      )}
    </div>
  );
}
