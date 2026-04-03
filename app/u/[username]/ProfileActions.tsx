"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Crown, Clock, Pencil, BarChart3, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFollow } from "@/hooks/useFollow";
import { useRequestStatus } from "@/hooks/useMessageRequests";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Props = {
  profileId: string;
  username: string;
  initialIsFollowing: boolean;
  userId: string | null;
  isOwnProfile: boolean;
  isProvider: boolean;
};

export function ProfileActions({
  profileId, username, initialIsFollowing, userId, isOwnProfile, isProvider,
}: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { isFollowing, toggle } = useFollow({
    profileId,
    initialIsFollowing,
    userId,
  });

  const { status: requestStatus, loading: statusLoading } = useRequestStatus(
    userId,
    profileId
  );

  const [hasSubscriptionTier, setHasSubscriptionTier] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Client-side ownership check (server-side isOwnProfile may be wrong)
  const isOwn = isOwnProfile || (user?.id === profileId);

  // Check if provider has a subscription tier and if current user is subscribed
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

    if (userId) {
      supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", userId)
        .eq("provider_id", profileId)
        .eq("is_active", true)
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) setIsSubscribed(true);
        });
    }
  }, [profileId, userId, isProvider, isOwn]);

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
            Edit Profile
          </button>
          {isProvider && (
            <button
              onClick={() => router.push("/profile/analytics")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <BarChart3 size={14} />
              Analytics
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
              <span className="text-emerald-400">Link copied!</span>
            </>
          ) : (
            <>
              <Share2 size={14} />
              Share Profile
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Other user's profile ──
  function handleFollow() {
    if (!userId) { router.push("/auth/signin"); return; }
    toggle();
  }

  function handleMessage() {
    if (!userId) { router.push("/auth/signin"); return; }

    if (requestStatus === "accepted") {
      router.push(`/messages/${username}`);
    }
    // For pending or no request — the EnquireBar at the bottom handles the flow.
    if (requestStatus === "none" || requestStatus === "pending") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  async function handleSubscribe() {
    if (!userId) { router.push("/auth/signin"); return; }
    if (isSubscribed) return;

    setSubLoading(true);
    const { error } = await supabase.from("subscriptions").insert({
      subscriber_id: userId,
      provider_id: profileId,
    });
    setSubLoading(false);

    if (!error) setIsSubscribed(true);
  }

  const messageLabel = statusLoading
    ? "Request"
    : requestStatus === "accepted"
      ? "Chat"
      : requestStatus === "pending"
        ? "Pending"
        : "Request";

  const isPending = requestStatus === "pending";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={handleFollow}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
            isFollowing
              ? "border border-zinc-700 text-white hover:bg-zinc-800"
              : "bg-white text-zinc-950 hover:bg-zinc-200"
          )}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
        <button
          onClick={handleMessage}
          disabled={isPending}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5",
            isPending
              ? "border border-zinc-700 text-zinc-500 cursor-not-allowed"
              : "border border-zinc-700 text-white hover:bg-zinc-800"
          )}
        >
          {isPending && <Clock size={13} />}
          {messageLabel}
        </button>
      </div>

      {/* Subscribe button — only for providers with a subscription tier */}
      {hasSubscriptionTier && (
        <button
          onClick={handleSubscribe}
          disabled={isSubscribed || subLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all",
            isSubscribed
              ? "border border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 hover:from-amber-300 hover:to-amber-400 active:scale-[0.99]"
          )}
        >
          <Crown size={15} strokeWidth={2.5} />
          {isSubscribed ? "Subscribed" : subLoading ? "Subscribing..." : "Subscribe"}
        </button>
      )}
    </div>
  );
}
