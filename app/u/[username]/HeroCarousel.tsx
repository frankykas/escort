"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string };

export function HeroCarousel({ photos, username }: { photos: Photo[]; username: string }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    if (index !== current) setCurrent(index);
  }

  function lightboxNav(dir: 1 | -1, e: React.MouseEvent) {
    e.stopPropagation();
    setCurrent((c) => Math.min(Math.max(c + dir, 0), photos.length - 1));
  }

  if (photos.length === 0) {
    return (
      <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-amber-900/20 via-zinc-900 to-zinc-950">
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-[3/4] overflow-hidden">

        {/* ── Swipeable strip ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative h-full w-full flex-shrink-0 snap-center cursor-zoom-in"
              onClick={() => { setCurrent(i); setLightboxOpen(true); }}
            >
              <Image
                src={photo.url}
                alt={`${username} photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="100vw"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Top gradient — header readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Bottom gradient — blends into page bg for avatar overlap */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute right-3 top-14 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
            {current + 1} / {photos.length}
          </div>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && photos.length <= 12 && (
          <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full bg-white transition-all duration-300",
                  i === current ? "h-1.5 w-5 opacity-100" : "h-1.5 w-1.5 opacity-35"
                )}
              />
            ))}
          </div>
        )}

        {/* Zoom hint */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-10 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 backdrop-blur-md transition hover:bg-black/60 hover:text-white"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300 backdrop-blur-md hover:text-white"
            >
              <X size={18} />
            </button>

            {/* Counter */}
            {photos.length > 1 && (
              <div className="absolute left-0 right-0 top-4 flex justify-center">
                <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-[12px] text-zinc-400 backdrop-blur-md">
                  {current + 1} / {photos.length}
                </span>
              </div>
            )}

            {/* Image */}
            <div className="relative h-full w-full" onClick={() => setLightboxOpen(false)}>
              <Image
                src={photos[current].url}
                alt={username}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>

            {/* Prev */}
            {current > 0 && (
              <button
                onClick={(e) => lightboxNav(-1, e)}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur-md hover:bg-black/80"
              >
                ‹
              </button>
            )}

            {/* Next */}
            {current < photos.length - 1 && (
              <button
                onClick={(e) => lightboxNav(1, e)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur-md hover:bg-black/80"
              >
                ›
              </button>
            )}

            {/* Dots */}
            {photos.length > 1 && photos.length <= 12 && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                    className={cn(
                      "rounded-full bg-white transition-all",
                      i === current ? "h-1.5 w-5 opacity-100" : "h-1.5 w-1.5 opacity-35"
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
