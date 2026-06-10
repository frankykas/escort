"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt: string;
  size: number;        // e.g. 36, 48, 56
  hasStory?: boolean;  // whether the user has an active (unseen) story
  storyViewed?: boolean; // story exists but already viewed
  className?: string;
};

export function StoryRingAvatar({
  src,
  alt,
  size,
  hasStory = false,
  storyViewed = false,
  className,
}: Props) {
  const showRing = hasStory || storyViewed;
  const ringGradient = hasStory
    ? "bg-gradient-to-tr from-pink-400 via-sky-300 to-violet-400"
    : "bg-gray-300";

  return (
    <div
      className={cn(
        "relative flex-shrink-0",
        showRing && "rounded-full p-[2px]",
        showRing && ringGradient,
        hasStory && "story-ring-active shadow-[0_0_12px_rgba(244,114,182,0.25)]",
        className
      )}
    >
      <div className={cn(showRing && "rounded-full p-[1.5px] bg-white")}>
        {src ? (
          <div
            className="relative overflow-hidden rounded-full"
            style={{ width: size, height: size }}
          >
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes={`${size}px`}
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-full bg-gray-100 font-bold text-slate-600"
            style={{
              width: size,
              height: size,
              fontSize: size > 40 ? "1rem" : "0.875rem",
            }}
          >
            {alt[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
    </div>
  );
}
