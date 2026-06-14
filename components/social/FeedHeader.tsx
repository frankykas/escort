"use client";

import { SectionToggle } from "@/components/ui/SectionToggle";
import { useSection } from "@/contexts/SectionContext";

export function FeedHeader() {
  const { isCreatorSection } = useSection();

  return (
    <header
      className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300"
      style={{ borderColor: isCreatorSection ? "#ede9fe" : "#f3e8ff50" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span
          className="text-2xl font-bold tracking-tight bg-clip-text text-transparent transition-all duration-300"
          style={{
            backgroundImage: isCreatorSection
              ? "linear-gradient(to right, #8b5cf6, #c084fc)"
              : "linear-gradient(to right, #f472b6, #38bdf8)",
          }}
        >
          Cleopatra
        </span>
        <SectionToggle compact className="w-[210px]" />
      </div>
    </header>
  );
}
