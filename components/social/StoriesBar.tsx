"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { StoryViewer } from "./StoryViewer";
import type { FeedPostData } from "./SocialHome";

type Props = { posts: FeedPostData[] };

export function StoriesBar({ posts }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // One story per provider — keep the most recent post per provider
  const seen = new Set<string>();
  const stories = posts
    .filter((p) => {
      if (seen.has(p.profiles.id)) return false;
      seen.add(p.profiles.id);
      return true;
    })
    .slice(0, 12);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="border-b border-zinc-800 bg-black">
        <div
          className="flex gap-4 overflow-x-auto px-4 py-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {stories.map((post, index) => {
            const { id, username, avatar_url } = post.profiles;
            return (
              <button
                key={id}
                onClick={() => setActiveIndex(index)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
                aria-label={`View ${username}'s story`}
              >
                {/* Amber gradient ring */}
                <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 transition-opacity hover:opacity-80">
                  <div className="rounded-full p-[2px] bg-black">
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
                        {username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="max-w-[60px] truncate text-[10px] text-zinc-400">
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
          <StoryViewer
            stories={stories}
            initialIndex={activeIndex}
            onClose={() => setActiveIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
