"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Filters = {
  verifiedOnly: boolean;
  availableNow: boolean;
  incall: boolean;
  outcall: boolean;
  minAge: number;
  maxAge: number;
  minRate: number;
  maxRate: number;
  categories: string[];
};

export const DEFAULT_FILTERS: Filters = {
  verifiedOnly: false,
  availableNow: false,
  incall: false,
  outcall: false,
  minAge: 18,
  maxAge: 55,
  minRate: 0,
  maxRate: 1000,
  categories: [],
};

const CATEGORIES = [
  "Companionship",
  "Dinner Date",
  "Travel",
  "GFE",
  "Couples",
  "Massage",
  "Domination",
];

type Props = {
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
};

export function FilterDrawer({ filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<Filters>(filters);

  function toggleCategory(cat: string) {
    setLocal((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        key="drawer"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border-t border-gray-200 bg-white"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-gray-100">
          <button
            onClick={() => setLocal(DEFAULT_FILTERS)}
            className="text-[13px] text-slate-400 hover:text-slate-700 transition-colors"
          >
            Reset
          </button>
          <span className="text-[15px] font-semibold text-slate-800">Filters</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Availability */}
          <section>
            <SectionTitle>Availability</SectionTitle>
            <div className="flex gap-2 flex-wrap mt-3">
              <PillToggle
                label="Any time"
                active={!local.availableNow}
                onClick={() => setLocal((f) => ({ ...f, availableNow: false }))}
              />
              <PillToggle
                label="Available now"
                active={local.availableNow}
                onClick={() => setLocal((f) => ({ ...f, availableNow: true }))}
              />
            </div>
          </section>

          {/* Service type */}
          <section>
            <SectionTitle>Service type</SectionTitle>
            <div className="flex flex-wrap gap-2 mt-3">
              {CATEGORIES.map((cat) => (
                <PillToggle
                  key={cat}
                  label={cat}
                  active={local.categories.includes(cat)}
                  onClick={() => toggleCategory(cat)}
                />
              ))}
            </div>
          </section>

          {/* Call type */}
          <section>
            <SectionTitle>Call type</SectionTitle>
            <div className="flex gap-2 mt-3">
              <PillToggle
                label="In-call"
                active={local.incall}
                onClick={() => setLocal((f) => ({ ...f, incall: !f.incall }))}
              />
              <PillToggle
                label="Out-call"
                active={local.outcall}
                onClick={() => setLocal((f) => ({ ...f, outcall: !f.outcall }))}
              />
            </div>
          </section>

          {/* Rate */}
          <section>
            <SectionTitle>Rate per hour</SectionTitle>
            <div className="flex items-center gap-3 mt-3">
              <NumberInput
                label="Min"
                prefix="CA$"
                value={local.minRate}
                onChange={(v) => setLocal((f) => ({ ...f, minRate: v }))}
                min={0}
                max={5000}
              />
              <div className="h-px w-4 bg-gray-300 flex-shrink-0" />
              <NumberInput
                label="Max"
                prefix="CA$"
                value={local.maxRate}
                onChange={(v) => setLocal((f) => ({ ...f, maxRate: v }))}
                min={0}
                max={5000}
              />
            </div>
          </section>

          {/* Age */}
          <section>
            <SectionTitle>Age range</SectionTitle>
            <div className="flex items-center gap-3 mt-3">
              <NumberInput
                label="Min"
                value={local.minAge}
                onChange={(v) => setLocal((f) => ({ ...f, minAge: v }))}
                min={18}
                max={70}
              />
              <div className="h-px w-4 bg-gray-300 flex-shrink-0" />
              <NumberInput
                label="Max"
                value={local.maxAge}
                onChange={(v) => setLocal((f) => ({ ...f, maxAge: v }))}
                min={18}
                max={70}
              />
            </div>
          </section>

          {/* Verified only */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <SectionTitle>Verified only</SectionTitle>
                <p className="text-[12px] text-slate-400 mt-0.5">Show ID-verified providers only</p>
              </div>
              <Toggle
                active={local.verifiedOnly}
                onClick={() => setLocal((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
              />
            </div>
          </section>
        </div>

        {/* Apply */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 pt-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          <button
            onClick={() => onApply(local)}
            className="w-full rounded-2xl bg-[rgb(246,51,154)] py-3.5 text-[15px] font-semibold text-white transition-all active:scale-[0.98] hover:brightness-105"
          >
            Apply filters
          </button>
        </div>
      </motion.div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>
  );
}

function PillToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all",
        active
          ? "border-pink-300 bg-pink-50 text-pink-500"
          : "border-gray-200 bg-gray-50 text-slate-500 hover:border-pink-200 hover:text-slate-700"
      )}
    >
      {label}
    </button>
  );
}

function NumberInput({
  label,
  prefix,
  value,
  onChange,
  min = 0,
  max = 9999,
}: {
  label: string;
  prefix?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex-1">
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        {prefix && <span className="mr-1 text-[13px] text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) =>
            onChange(Math.max(min, Math.min(max, Number(e.target.value))))
          }
          className="w-full bg-transparent text-[13px] text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200",
        active ? "bg-pink-400" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200",
          active ? "left-[calc(100%-26px)]" : "left-0.5"
        )}
      />
    </button>
  );
}
