"use client";

/**
 * SpotlightTour — guided onboarding tour with a dimmed backdrop and a "hole"
 * cut around the highlighted target element.
 *
 * Steps reference DOM elements by `data-tour="<id>"` attribute. The tour
 * computes the target's bounding box, dims everything else, and shows a
 * tooltip card pointing at the element.
 *
 * Usage:
 *   <SpotlightTour
 *     steps={[
 *       { target: "feed-tab", title: "Your Feed", body: "Browse the latest posts here." },
 *       { target: "create-post", title: "Create a post", body: "Tap here to share something." },
 *     ]}
 *     storageKey="provider-tour"
 *   />
 *
 *   <button data-tour="feed-tab">...</button>
 */

import { useEffect, useState, useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TourStep = {
  /** The data-tour attribute value of the element to highlight. */
  target: string;
  title: string;
  body: string;
  /** Tooltip placement relative to the target. Auto-detected if omitted. */
  placement?: "top" | "bottom";
};

type Props = {
  steps: TourStep[];
  /** A unique key per tour. Once completed, the tour won't run again. */
  storageKey: string;
  /** Force the tour open regardless of completion state. Useful for "Restart tour" buttons. */
  forceOpen?: boolean;
  /** Called when the user finishes or skips. */
  onClose?: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 10;       // space around the highlighted element
const RADIUS = 14;        // corner radius of the highlight cutout
const TOOLTIP_GAP = 16;   // distance between target and tooltip
const TOOLTIP_WIDTH = 320;
const VIEWPORT_MARGIN = 16;

export function SpotlightTour({ steps, storageKey, forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(180);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Mount detection (portals can't render server-side)
  useEffect(() => setMounted(true), []);

  // Decide whether to open the tour
  useEffect(() => {
    if (!mounted) return;
    if (forceOpen) {
      setOpen(true);
      setStepIndex(0);
      return;
    }
    const seen = localStorage.getItem(`tour:${storageKey}`);
    if (!seen) {
      // Small delay so target elements have time to render
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [mounted, forceOpen, storageKey]);

  const currentStep = steps[stepIndex];

  // Measure the target element whenever step changes or on resize/scroll
  const measure = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${currentStep.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Scroll into view if it's offscreen
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, stepIndex, measure]);

  // Re-measure tooltip height whenever content changes so position stays accurate
  useLayoutEffect(() => {
    if (!open || !tooltipRef.current) return;
    const h = tooltipRef.current.getBoundingClientRect().height;
    if (h > 0 && Math.abs(h - tooltipHeight) > 2) {
      setTooltipHeight(h);
    }
  });

  useEffect(() => {
    if (!open) return;
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, measure]);

  function complete() {
    localStorage.setItem(`tour:${storageKey}`, "done");
    setOpen(false);
    onClose?.();
  }

  function next() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      complete();
    }
  }

  if (!mounted || !open || !currentStep) return null;

  // Compute SVG mask path: full screen with a rounded-rect cutout
  const cutout = rect && {
    x: rect.left - PADDING,
    y: rect.top - PADDING,
    w: rect.width + PADDING * 2,
    h: rect.height + PADDING * 2,
  };

  // Compute tooltip position with smart placement + viewport clamping
  const tooltipStyle: React.CSSProperties = (() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;

    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    // How much room is available above and below the target (minus the cutout padding + gap)
    const roomAbove = rect.top - PADDING - TOOLTIP_GAP;
    const roomBelow = vh - (rect.top + rect.height) - PADDING - TOOLTIP_GAP;

    // Honor forced placement if set; otherwise prefer whichever side has enough room
    let placement: "top" | "bottom" | "center" = currentStep.placement ?? "bottom";
    if (!currentStep.placement) {
      if (roomBelow >= tooltipHeight + VIEWPORT_MARGIN) placement = "bottom";
      else if (roomAbove >= tooltipHeight + VIEWPORT_MARGIN) placement = "top";
      else placement = "center";
    }

    let top: number;
    if (placement === "bottom") {
      top = rect.top + rect.height + TOOLTIP_GAP + PADDING;
    } else if (placement === "top") {
      top = rect.top - PADDING - TOOLTIP_GAP - tooltipHeight;
    } else {
      // Center vertically — neither side fits
      top = Math.max(VIEWPORT_MARGIN, (vh - tooltipHeight) / 2);
    }

    // Final vertical clamp
    top = Math.max(VIEWPORT_MARGIN, Math.min(vh - tooltipHeight - VIEWPORT_MARGIN, top));

    // Horizontal: center on target, then clamp to viewport
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN, left));

    return { top, left };
  })();

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="spotlight-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* SVG mask: dim everything except the cutout */}
        <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={next}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {cutout && (
                <rect
                  x={cutout.x}
                  y={cutout.y}
                  width={cutout.w}
                  height={cutout.h}
                  rx={RADIUS}
                  ry={RADIUS}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.78)"
            mask="url(#spotlight-mask)"
          />
          {/* Soft amber glow ring around the cutout */}
          {cutout && (
            <rect
              x={cutout.x}
              y={cutout.y}
              width={cutout.w}
              height={cutout.h}
              rx={RADIUS}
              ry={RADIUS}
              fill="none"
              stroke="rgba(251,191,36,0.6)"
              strokeWidth={2}
              className="pointer-events-none"
            />
          )}
        </svg>

        {/* Tooltip card */}
        <motion.div
          ref={tooltipRef}
          key={`tooltip-${stepIndex}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          style={tooltipStyle}
          className="absolute w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-amber-400/30 bg-zinc-900 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.6)] pointer-events-auto"
        >
          {/* Close button */}
          <button
            onClick={complete}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            aria-label="Skip tour"
          >
            <X size={14} />
          </button>

          {/* Step counter */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Step {stepIndex + 1} of {steps.length}
          </p>

          {/* Title + body */}
          <h3 className="text-[16px] font-bold text-white pr-6">{currentStep.title}</h3>
          <p className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed">{currentStep.body}</p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === stepIndex ? "w-5 bg-amber-400" : "w-1.5 bg-zinc-700"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {stepIndex < steps.length - 1 && (
                <button
                  onClick={complete}
                  className="text-[12px] font-medium text-zinc-500 hover:text-zinc-300 transition"
                >
                  Skip
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1.5 text-[12px] font-bold text-zinc-950 transition hover:bg-amber-300"
              >
                {stepIndex === steps.length - 1 ? "Got it" : "Next"}
                {stepIndex < steps.length - 1 && <ArrowRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/**
 * Convenience hook to manually trigger / reset a tour.
 *
 *   const { restart } = useSpotlightTour("provider-tour");
 *   <button onClick={restart}>Replay tour</button>
 */
export function useSpotlightTour(storageKey: string) {
  const [forceOpen, setForceOpen] = useState(false);

  const restart = useCallback(() => {
    localStorage.removeItem(`tour:${storageKey}`);
    setForceOpen(true);
    // Reset on next tick so a subsequent restart will re-trigger
    setTimeout(() => setForceOpen(false), 100);
  }, [storageKey]);

  const markComplete = useCallback(() => {
    localStorage.setItem(`tour:${storageKey}`, "done");
  }, [storageKey]);

  return { forceOpen, restart, markComplete };
}
