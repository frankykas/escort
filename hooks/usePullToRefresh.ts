"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Options = {
  onRefresh: () => Promise<void>;
  threshold?: number;    // px to pull before triggering (default 80)
  maxPull?: number;      // max pull distance (default 120)
};

export function usePullToRefresh({ onRefresh, threshold = 80, maxPull = 120 }: Options) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only allow pull-to-refresh when scrolled to top
    if (window.scrollY > 0) {
      isAtTop.current = false;
      return;
    }
    isAtTop.current = true;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isAtTop.current || refreshing) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      // Apply resistance: the further you pull, the harder it gets
      const distance = Math.min(diff * 0.5, maxPull);
      setPullDistance(distance);
      setPulling(true);
    }
  }, [refreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }

    setPulling(false);
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return { pulling, refreshing, pullDistance, progress };
}
