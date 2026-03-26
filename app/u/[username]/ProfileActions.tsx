"use client";

import { useRouter } from "next/navigation";
import { useFollow } from "@/hooks/useFollow";

type Props = {
  profileId: string;
  initialIsFollowing: boolean;
  userId: string | null;
  isOwnProfile: boolean;
};

export function ProfileActions({ profileId, initialIsFollowing, userId, isOwnProfile }: Props) {
  const router = useRouter();
  const { isFollowing, toggle } = useFollow({
    profileId,
    initialIsFollowing,
    userId,
  });

  if (isOwnProfile) {
    return (
      <div className="flex gap-2">
        <button
          disabled
          className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white opacity-60"
        >
          Edit Profile
        </button>
      </div>
    );
  }

  function handleFollow() {
    if (!userId) {
      router.push("/auth/signin");
      return;
    }
    toggle();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleFollow}
        className={
          isFollowing
            ? "flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            : "flex-1 rounded-lg bg-white py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        }
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
      <button
        disabled
        className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-white opacity-60"
      >
        Message
      </button>
    </div>
  );
}
