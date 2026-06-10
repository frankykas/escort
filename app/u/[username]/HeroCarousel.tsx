"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string };

export function HeroCarousel({ photos, username }: { photos: Photo[]; username: string }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth, scrollWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / offsetWidth);
    if (index !== current) setCurrent(index);
    // Track continuous scroll progress for parallax
    setScrollProgress(scrollLeft / (scrollWidth - offsetWidth || 1));
  }

  // Parallax on page scroll
  const [pageScrollY, setPageScrollY] = useState(0);
  useEffect(() => {
    function onScroll() {
      setPageScrollY(window.scrollY);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function lightboxNav(dir: 1 | -1, e: React.MouseEvent) {
    e.stopPropagation();
    setCurrent((c) => Math.min(Math.max(c + dir, 0), photos.length - 1));
  }

  if (photos.length === 0) {
    return (
      <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-pink-100 via-sky-50 to-white">
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#fafbfc] to-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-[3/4] overflow-hidden">

        {/* ── Swipeable strip with parallax ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide"
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative h-full w-full flex-shrink-0 snap-center cursor-zoom-in overflow-hidden"
              onClick={() => { setCurrent(i); setLightboxOpen(true); }}
            >
              <Image
                src={photo.url}
                alt={`${username} photo ${i + 1}`}
                fill
                className="object-cover transition-transform duration-100 will-change-transform"
                style={{
                  transform: `translateY(${pageScrollY * 0.15}px) scale(${1 + pageScrollY * 0.0003})`,
                }}
                sizes="100vw"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Top gradient — header readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Bottom gradient — blends into page bg for avatar overlap */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#fafbfc] via-[#fafbfc]/70 to-transparent" />

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute right-3 top-14 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
            {current + 1} / {photos.length}
          </div>
        )}

        {/* Dot indicators with animated transitions */}
        {photos.length > 1 && photos.length <= 12 && (
          <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <motion.div
                key={i}
                className="rounded-full bg-white"
                animate={{
                  width: i === current ? 20 : 6,
                  opacity: i === current ? 1 : 0.35,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ height: 6 }}
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
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-md hover:text-white"
            >
              <X size={18} />
            </button>

            {/* Counter */}
            {photos.length > 1 && (
              <div className="absolute left-0 right-0 top-4 flex justify-center">
                <span className="rounded-full bg-black/40 px-3 py-1 text-[12px] text-white/70 backdrop-blur-md">
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
