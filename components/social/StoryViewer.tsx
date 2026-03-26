"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Heart, MessageCircle } from "lucide-react";
import type { FeedPostData } from "./SocialHome";

type Props = {
  stories: FeedPostData[];
  initialIndex: number;
  onClose: () => void;
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function StoryViewer({ stories, initialIndex, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  const story = stories[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const { username, avatar_url, verification_status } = story.profiles;
  const isVerified = verification_status === "verified";

  const slideVariants = {
    enter: (d: number) => ({
      x: d >= 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d >= 0 ? "-25%" : "25%",
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    // Backdrop — click outside the card closes
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      {/* Story card — stop propagation so clicks inside don't close */}
      <div
        className="relative w-full h-full max-w-sm overflow-hidden bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Progress bars ── */}
        <div className="absolute top-0 inset-x-0 z-30 flex gap-[3px] px-2 pt-[env(safe-area-inset-top,0px)] pt-3">
          {stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[2px] rounded-full bg-white/25 overflow-hidden"
            >
              {i < currentIndex ? (
                // Completed stories — fully filled
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === currentIndex ? (
                // Current story — animated fill
                <motion.div
                  key={`bar-${currentIndex}`}
                  className="h-full bg-white rounded-full origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 5, ease: "linear" }}
                  onAnimationComplete={handleNext}
                />
              ) : null /* Future stories — empty */ }
            </div>
          ))}
        </div>

        {/* ── Header ── */}
        <div className="absolute top-7 inset-x-0 z-30 flex items-center justify-between px-3">
          <Link
            href={`/u/${username}`}
            onClick={onClose}
            className="flex items-center gap-2.5 group"
          >
            <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex-shrink-0">
              <div className="rounded-full p-[1.5px] bg-black/50">
                {avatar_url ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
                    <Image
                      src={avatar_url}
                      alt={username}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-white">
                    {username[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)] group-hover:underline">
                  {username}
                </span>
                {isVerified && (
                  <CheckCircle
                    size={11}
                    className="text-amber-400 fill-amber-400/20 flex-shrink-0"
                  />
                )}
              </div>
              <span className="text-[10px] text-white/60">
                {formatTimeAgo(story.created_at)}
              </span>
            </div>
          </Link>

          <button
            onClick={onClose}
            aria-label="Close story"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Story image (slides in/out) ── */}
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {story.media_url ? (
              <Image
                src={story.media_url}
                alt={story.caption ?? "Story"}
                fill
                className="object-cover"
                sizes="(max-width: 384px) 100vw, 384px"
                priority
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-amber-900/40 via-zinc-900 to-black" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Bottom gradient + caption + stats ── */}
        <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/85 via-black/30 to-transparent pt-20 pb-8 px-4 pointer-events-none">
          {story.caption && (
            <p className="text-sm leading-relaxed text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
              <span className="font-semibold mr-1.5">{username}</span>
              {story.caption}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[12px] text-white/60">
              <Heart size={13} />
              {story.likes_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-white/60">
              <MessageCircle size={13} />
              {story.comments_count.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ── Tap zones (prev / next) ── */}
        <div className="absolute inset-0 z-20 flex">
          <div className="w-1/3 h-full" onClick={handlePrev} />
          <div className="flex-1 h-full" onClick={handleNext} />
        </div>
      </div>
    </motion.div>
  );
}
