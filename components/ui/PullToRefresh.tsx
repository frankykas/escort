"use client";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

type Props = {
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
  progress: number;
};

export function PullToRefreshIndicator({ pulling, refreshing, pullDistance, progress }: Props) {
  if (!pulling && !refreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-200"
      style={{ height: refreshing ? 48 : pullDistance }}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          "border border-amber-400/30 bg-amber-400/10",
          refreshing && "ptr-spinner"
        )}
        style={{
          opacity: refreshing ? 1 : progress,
          transform: `rotate(${progress * 360}deg)`,
        }}
      >
        <RefreshCw size={14} className="text-amber-400" />
      </div>
    </div>
  );
}
