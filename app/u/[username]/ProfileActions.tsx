"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Crown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFollow } from "@/hooks/useFollow";
import { useRequestStatus } from "@/hooks/useMessageRequests";
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

  // Check if provider has a subscription tier and if current user is subscribed
  useEffect(() => {
    if (!isProvider || isOwnProfile) return;

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
  }, [profileId, userId, isProvider, isOwnProfile]);

  if (isOwnProfile) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => router.push("/profile/edit")}
          className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          Edit Profile
        </button>
      </div>
    );
  }

  function handleFollow() {
    if (!userId) { router.push("/auth/signin"); return; }
    toggle();
  }

  function handleMessage() {
    if (!userId) { router.push("/auth/signin"); return; }

    if (requestStatus === "accepted") {
      router.push(`/messages/${username}`);
    } else {
      // For pending or no request — scroll to EnquireBar CTA which handles the flow
      router.push(`/messages/${username}`);
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
    ? "Message"
    : requestStatus === "accepted"
      ? "Chat"
      : requestStatus === "pending"
        ? "Pending"
        : "Message";

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
