"use client";

import { useEffect } from "react";
import type { ElementType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  ChevronLeft,
  Contrast,
  Eye,
  Hand,
  Mic,
  Moon,
  RotateCcw,
  Smartphone,
  Type,
  Vibrate,
  Volume2,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useAccessibility } from "@/contexts/AccessibilityContext";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-300">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
        {children}
      </div>
    </section>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-gray-50"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-slate-400">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-slate-700">{label}</p>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">{description}</p>}
      </div>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-pink-400" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "left-5" : "left-0.5"
          )}
        />
      </span>
      <span className="sr-only">{checked ? t("a11y_on") : t("a11y_off")}</span>
    </button>
  );
}

function ChoiceRow<T extends string>({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ElementType;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-slate-400">
          <Icon size={18} />
        </div>
        <p className="text-[14px] font-medium text-slate-700">{label}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-[13px] font-medium transition",
              option.value === value
                ? "border-pink-300 bg-pink-50 text-pink-500"
                : "border-gray-200 bg-gray-50 text-slate-500 hover:bg-gray-100"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  body,
}: {
  icon: ElementType;
  label: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-slate-400">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[14px] font-medium text-slate-700">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">{body}</p>
      </div>
    </div>
  );
}

export default function AccessibilityPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const { t } = useTranslation();
  const { prefs, setPref, resetPrefs } = useAccessibility();

  useEffect(() => {
    if (!checked) return;
    if (!user) router.replace("/auth/signin");
  }, [checked, router, user]);

  if (!checked || !user) return null;

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("back")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("a11y_title")}</span>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        <Section title={t("a11y_display")}>
          <ChoiceRow
            icon={Moon}
            label={t("a11y_dark_mode")}
            value={prefs.theme}
            onChange={(value) => setPref("theme", value)}
            options={[
              { label: t("a11y_theme_light"), value: "light" },
              { label: t("a11y_theme_dark"), value: "dark" },
              { label: t("a11y_theme_system"), value: "system" },
            ]}
          />
          <ChoiceRow
            icon={Type}
            label={t("a11y_text_size")}
            value={prefs.textScale}
            onChange={(value) => setPref("textScale", value)}
            options={[
              { label: "100%", value: "100" },
              { label: "115%", value: "115" },
              { label: "130%", value: "130" },
            ]}
          />
          <ChoiceRow
            icon={Eye}
            label={t("a11y_page_zoom")}
            value={prefs.pageZoom}
            onChange={(value) => setPref("pageZoom", value)}
            options={[
              { label: "100%", value: "100" },
              { label: "110%", value: "110" },
              { label: "125%", value: "125" },
            ]}
          />
          <ToggleRow
            icon={Contrast}
            label={t("a11y_high_contrast")}
            checked={prefs.highContrast}
            onChange={(checked) => setPref("highContrast", checked)}
          />
        </Section>

        <Section title={t("a11y_interaction")}>
          <ToggleRow
            icon={ZapOff}
            label={t("a11y_reduce_motion")}
            checked={prefs.reduceMotion}
            onChange={(checked) => setPref("reduceMotion", checked)}
          />
          <ToggleRow
            icon={Hand}
            label={t("a11y_large_targets")}
            checked={prefs.largeTargets}
            onChange={(checked) => setPref("largeTargets", checked)}
          />
          <ToggleRow
            icon={Vibrate}
            label={t("a11y_haptics")}
            checked={prefs.haptics}
            onChange={(checked) => setPref("haptics", checked)}
          />
          <ToggleRow
            icon={Mic}
            label={t("a11y_voice_controls")}
            description={t("a11y_voice_hint")}
            checked={prefs.voiceControls}
            onChange={(checked) => setPref("voiceControls", checked)}
          />
        </Section>

        <Section title={t("a11y_assistive")}>
          <InfoRow icon={Volume2} label={t("a11y_screen_reader")} body={t("a11y_screen_reader_body")} />
          <InfoRow icon={Smartphone} label={t("a11y_page_zoom")} body={t("a11y_zoom_support")} />
        </Section>

        <button
          type="button"
          onClick={resetPrefs}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-[14px] font-semibold text-slate-600 transition hover:bg-gray-50"
        >
          <RotateCcw size={15} />
          {t("a11y_reset")}
        </button>
      </div>
    </div>
  );
}
