"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ImageCarousel({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const count = images.length;

  if (count === 0) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }

  function handleTouchEnd() {
    const threshold = 50;
    if (touchDeltaX.current < -threshold && current < count - 1) {
      setCurrent((p) => p + 1);
    } else if (touchDeltaX.current > threshold && current > 0) {
      setCurrent((p) => p - 1);
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: "52vw", maxHeight: "520px", height: "65vw" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${current * 100}%)`, width: `${count * 100}%` }}
      >
        {images.map((url, i) => (
          <div key={url} className="relative h-full" style={{ width: `${100 / count}%` }}>
            <Image
              src={url}
              alt={`${title} — photo ${i + 1}`}
              fill
              className="object-cover brightness-[0.45]"
              sizes="100vw"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Dot indicators (Instagram-style progress bars) */}
      {count > 1 && (
        <div className="absolute top-3 inset-x-4 flex gap-1 pointer-events-none z-20">
          {images.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-all duration-300",
                i === current ? "bg-white" : "bg-white/30"
              )}
            />
          ))}
        </div>
      )}

      {/* Image counter */}
      {count > 1 && (
        <div className="absolute top-3 right-3 z-20 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm pointer-events-none">
          {current + 1}/{count}
        </div>
      )}

      {/* Tap zones for desktop */}
      {count > 1 && (
        <>
          <button
            onClick={() => setCurrent((p) => Math.max(0, p - 1))}
            className="absolute left-0 top-0 bottom-0 w-1/4 z-10"
            aria-label="Previous photo"
          />
          <button
            onClick={() => setCurrent((p) => Math.min(count - 1, p + 1))}
            className="absolute right-0 top-0 bottom-0 w-1/4 z-10"
            aria-label="Next photo"
          />
        </>
      )}
    </div>
  );
}
