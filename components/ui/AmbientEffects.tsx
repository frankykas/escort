"use client";

import { useEffect, useRef, useState } from "react";

// ─── 1. Ambient Gold Aura ───────────────────────────────────────────────────
// Two large, ultra-soft radial gradients that drift based on scroll position.
// Uses mix-blend-mode: screen to blend with content beneath, so it shows
// through even over opaque dark backgrounds.

export function AmbientAura() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setOffset(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Slow, organic drift based on scroll position
  const y1 = -120 + (offset * 0.08) % 400;
  const y2 = 200 + (offset * 0.05) % 500;
  const x1 = 10 + Math.sin(offset * 0.002) * 15;
  const x2 = 75 + Math.cos(offset * 0.0015) * 20;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
      aria-hidden="true"
    >
      {/* Primary warm glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: "700px",
          height: "700px",
          background: "radial-gradient(circle, rgba(252,186,3,0.08) 0%, rgba(232,147,12,0.04) 35%, transparent 70%)",
          filter: "blur(100px)",
          left: `${x1}%`,
          top: `${y1}px`,
          transform: "translate(-50%, -50%)",
          transition: "left 2s ease-out, top 2s ease-out",
        }}
      />

      {/* Secondary accent */}
      <div
        className="absolute rounded-full"
        style={{
          width: "550px",
          height: "550px",
          background: "radial-gradient(circle, rgba(245,166,35,0.06) 0%, rgba(252,186,3,0.03) 30%, transparent 70%)",
          filter: "blur(80px)",
          left: `${x2}%`,
          top: `${y2}px`,
          transform: "translate(-50%, -50%)",
          transition: "left 2.5s ease-out, top 2.5s ease-out",
        }}
      />
    </div>
  );
}

// ─── 5. Soft Vignette ────────────────────────────────────────────────────────
// Fixed darkening at top/bottom edges — creates a lens-like depth effect
// and helps headers/nav blend naturally.

export function Vignette() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
      {/* Top vignette */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "100px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)",
        }}
      />
      {/* Bottom vignette */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "120px",
          background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 40%, transparent 100%)",
        }}
      />
    </div>
  );
}

// ─── 3. Scroll-Reveal Wrapper ────────────────────────────────────────────────
// Wraps any element. Fades up + slight scale when entering the viewport.
// Uses IntersectionObserver for 60fps performance (no scroll listener).

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translateY(0) scale(1)"
          : "translateY(16px) scale(0.98)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ─── useScrollReveal hook ────────────────────────────────────────────────────

export function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -30px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
