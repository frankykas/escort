"use client";

import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSection, type AppSection } from "@/contexts/SectionContext";

type Props = {
  /** Compact mode for tight headers */
  compact?: boolean;
  className?: string;
};

const sections: { id: AppSection; icon: typeof Crown; label: string; labelFr: string }[] = [
  { id: "escorts", icon: Crown, label: "Escorts", labelFr: "Escortes" },
  { id: "creators", icon: Sparkles, label: "Creators", labelFr: "Créatrices" },
];

export function SectionToggle({ compact = false, className }: Props) {
  const { section, setSection } = useSection();

  return (
    <div
      className={cn(
        "relative flex items-center rounded-full p-[3px]",
        "bg-gray-100/80 backdrop-blur-sm",
        "shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      {/* Animated sliding indicator */}
      <motion.div
        className={cn(
          "absolute top-[3px] bottom-[3px] rounded-full shadow-sm",
          section === "escorts"
            ? "bg-gradient-to-r from-pink-500 to-rose-400"
            : "bg-gradient-to-r from-violet-500 to-purple-400",
        )}
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: "calc(50% - 3px)",
          left: section === "escorts" ? "3px" : "calc(50%)",
        }}
      />

      {sections.map((s) => {
        const Icon = s.icon;
        const active = section === s.id;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full transition-colors duration-200",
              compact ? "px-3 py-1.5" : "px-4 py-2",
              active ? "text-white" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon
              size={compact ? 13 : 15}
              strokeWidth={active ? 2.2 : 1.8}
              className={cn(
                "transition-all duration-200",
                active && s.id === "escorts" && "fill-pink-200/40",
                active && s.id === "creators" && "fill-violet-200/40",
              )}
            />
            <span
              className={cn(
                "font-semibold tracking-tight transition-all duration-200",
                compact ? "text-[11px]" : "text-[12px]",
              )}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
