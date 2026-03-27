"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, CheckCircle, Zap, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListingFilters = {
  verifiedOnly: boolean;
  availableNow: boolean;
  incall: boolean;
  outcall: boolean;
  minRate: number;  // CA$ (display), stored as dollars
  maxRate: number;
};

export const DEFAULT_FILTERS: ListingFilters = {
  verifiedOnly: false,
  availableNow: false,
  incall: false,
  outcall: false,
  minRate: 0,
  maxRate: 2000,
};

type Props = {
  filters: ListingFilters;
  onApply: (f: ListingFilters) => void;
  onClose: () => void;
};

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function TogglePill({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full rounded-2xl border px-4 py-3.5 text-left transition-all",
        active
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-white/8 bg-zinc-900 hover:border-white/15"
      )}
    >
      {Icon && (
        <div className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl",
          active ? "bg-amber-400/20" : "bg-zinc-800"
        )}>
          <Icon size={15} className={active ? "text-amber-400" : "text-zinc-500"} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("text-[14px] font-semibold", active ? "text-amber-400" : "text-zinc-200")}>
          {label}
        </p>
        {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
      </div>
      <div className={cn(
        "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all",
        active
          ? "border-amber-400 bg-amber-400"
          : "border-zinc-700 bg-transparent"
      )}>
        {active && <Check size={11} className="text-zinc-950" strokeWidth={3} />}
      </div>
    </button>
  );
}

// ─── Price slider ─────────────────────────────────────────────────────────────

function PriceRange({
  min, max, onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const MAX = DEFAULT_FILTERS.maxRate;

  const presets = [
    { label: "Any", min: 0, max: MAX },
    { label: "Under $200", min: 0, max: 200 },
    { label: "$200–500", min: 200, max: 500 },
    { label: "$500–1000", min: 500, max: 1000 },
    { label: "$1000+", min: 1000, max: MAX },
  ];

  const activePreset = presets.find((p) => p.min === min && p.max === max);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.min === min && p.max === max;
          return (
            <button
              key={p.label}
              onClick={() => onChange(p.min, p.max)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                active
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                  : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* Custom range display */}
      {!activePreset && (
        <p className="mt-2 text-[12px] text-zinc-400">
          CA${min.toLocaleString()} – CA${max === MAX ? max.toLocaleString() + "+" : max.toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function ListingsFilterDrawer({ filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<ListingFilters>({ ...filters });

  function patch(key: keyof ListingFilters, value: boolean | number) {
    setLocal((f) => ({ ...f, [key]: value }));
  }

  function toggle(key: keyof ListingFilters) {
    setLocal((f) => ({ ...f, [key]: !f[key] }));
  }

  const isDefault =
    JSON.stringify(local) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <p className="text-[17px] font-bold text-white">Filters</p>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto px-5 py-5 space-y-6">

          {/* Quick toggles */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Status
            </p>
            <div className="space-y-2">
              <TogglePill
                active={local.verifiedOnly}
                onClick={() => toggle("verifiedOnly")}
                icon={CheckCircle}
                label="Verified only"
                sub="Show providers with a gold verification badge"
              />
              <TogglePill
                active={local.availableNow}
                onClick={() => toggle("availableNow")}
                icon={Zap}
                label="Available now"
                sub="Only show providers currently marked as live"
              />
            </div>
          </section>

          {/* In-call / Out-call */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Service type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["incall", "outcall"] as const).map((type) => {
                const active = local[type];
                return (
                  <button
                    key={type}
                    onClick={() => toggle(type)}
                    className={cn(
                      "rounded-2xl border py-4 text-[13px] font-semibold capitalize transition-all",
                      active
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                        : "border-white/8 bg-zinc-900 text-zinc-300 hover:border-white/15"
                    )}
                  >
                    {type === "incall" ? "In-call" : "Out-call"}
                  </button>
                );
              })}
            </div>
            {local.incall && local.outcall && (
              <p className="mt-1.5 text-[11px] text-zinc-600">Showing listings that offer either</p>
            )}
          </section>

          {/* Price range */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Price range
            </p>
            <PriceRange
              min={local.minRate}
              max={local.maxRate}
              onChange={(min, max) => setLocal((f) => ({ ...f, minRate: min, maxRate: max }))}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-white/5 px-5 pt-4">
          <button
            onClick={() => setLocal({ ...DEFAULT_FILTERS })}
            disabled={isDefault}
            className="flex-1 rounded-2xl border border-white/10 py-3 text-[14px] font-semibold text-zinc-400 transition-all hover:border-white/20 hover:text-zinc-200 disabled:opacity-30"
          >
            Reset
          </button>
          <button
            onClick={() => onApply(local)}
            className="flex-2 flex-grow-[2] rounded-2xl bg-amber-400 py-3 text-[14px] font-bold text-zinc-950 transition-all hover:bg-amber-300 active:scale-[0.98]"
          >
            Show results
          </button>
        </div>
      </motion.div>
    </>
  );
}
