"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { StoriesViewer } from "./StoriesViewer";
import { getActiveStories } from "@/lib/stories";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

type StoryGroup = {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
  latest_story_at: string;
  story_count: number;
  has_unseen: boolean;
  stories: {
    id: string;
    media_url: string | null;
    media_type: string;
    caption: string | null;
    created_at: string;
    expires_at: string;
    views_count: number;
  }[];
};

export function StoriesBar() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useSession();

  useEffect(() => {
    const loadStories = async () => {
      try {
        const storiesData = await getActiveStories(user?.id);
        setStories(storiesData);
      } catch (error) {
        console.error("Failed to load stories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="border-b border-gray-200 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex gap-7 overflow-x-auto px-4 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="h-14 w-14 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-2 w-12 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stories.length === 0) return null;

  return (
    <>
      <div className="border-b border-gray-200 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div
          className="flex gap-7 overflow-x-auto px-4 py-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {stories.map((story, index) => {
            const { provider_id: id, username, avatar_url, verification_status, has_unseen } = story;
            const isVerified = verification_status === "verified";
            return (
              <button
                key={id}
                onClick={() => setActiveIndex(index)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
                aria-label={`View ${username}'s story`}
              >
                {/* Gradient ring with unseen indicator */}
                <div className={cn(
                  "rounded-full p-[1px] bg-gradient-to-tr transition-opacity hover:opacity-80",
                  has_unseen
                    ? "from-pink-400 via-sky-300 to-violet-400"
                    : "from-gray-300 via-gray-200 to-gray-300"
                )}>
                  <div className="rounded-full p-[2px] bg-white">
                    {avatar_url ? (
                      <div className="relative h-14 w-14 overflow-hidden rounded-full">
                        <Image
                          src={avatar_url}
                          alt={username}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-slate-600">
                        {username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="max-w-[60px] truncate text-[10px] text-slate-500">
                  {username}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story viewer — rendered in a portal-like fixed overlay */}
      <AnimatePresence>
        {activeIndex !== null && (
          <StoriesViewer
            stories={stories}
            initialIndex={activeIndex}
            onClose={() => setActiveIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
