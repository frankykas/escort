"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";
import { STORAGE_KEY as LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n";

type A11yTheme = "light" | "dark" | "system";
type A11yScale = "100" | "115" | "130" | "150";
type A11yZoom = "100" | "110" | "125";

type AccessibilityPrefs = {
  theme: A11yTheme;
  textScale: A11yScale;
  pageZoom: A11yZoom;
  highContrast: boolean;
  reduceMotion: boolean;
  voiceControls: boolean;
  largeTargets: boolean;
  haptics: boolean;
};

type AccessibilityContextValue = {
  prefs: AccessibilityPrefs;
  setPref: <K extends keyof AccessibilityPrefs>(key: K, value: AccessibilityPrefs[K]) => void;
  resetPrefs: () => void;
};

type SpeechRecognitionEventLike = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const STORAGE_KEY = "cleopatra_accessibility";

const DEFAULT_PREFS: AccessibilityPrefs = {
  theme: "light",
  textScale: "100",
  pageZoom: "100",
  highContrast: false,
  reduceMotion: false,
  voiceControls: false,
  largeTargets: false,
  haptics: false,
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

function readPrefs(): AccessibilityPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFS;
    const parsed = JSON.parse(stored) as Partial<AccessibilityPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function resolveLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

function resolveTheme(theme: A11yTheme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isEditableElement(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return [
    "email",
    "number",
    "password",
    "search",
    "tel",
    "text",
    "url",
  ].includes(element.type);
}

function insertDictation(target: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const prefix = target.value.slice(0, start);
  const suffix = target.value.slice(end);
  const separator = prefix && !prefix.endsWith(" ") ? " " : "";
  const next = `${prefix}${separator}${text}${suffix}`;

  target.value = next;
  const cursor = `${prefix}${separator}${text}`.length;
  target.setSelectionRange(cursor, cursor);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

function commandTarget(transcript: string): string | "back" | null {
  const phrase = transcript.toLowerCase().trim();
  const commands: Array<[string[], string | "back"]> = [
    [["go home", "open home", "accueil"], "/"],
    [["go explore", "open explore", "explorer"], "/explore"],
    [["go messages", "open messages"], "/messages"],
    [["go alerts", "open alerts", "notifications"], "/notifications"],
    [["go profile", "open profile", "profil"], "/profile"],
    [["go settings", "open settings", "parametres", "paramètres"], "/profile/settings"],
    [["go accessibility", "open accessibility", "accessibilite", "accessibilité"], "/profile/accessibility"],
    [["go back", "back", "retour"], "back"],
  ];

  return commands.find(([triggers]) => triggers.some((trigger) => phrase.includes(trigger)))?.[1] ?? null;
}

function VoiceAccessButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setMessage("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = resolveLocale() === "fr" ? "fr-CA" : "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (!transcript) return;

      const route = commandTarget(transcript);
      if (route === "back") {
        router.back();
        setMessage("Going back.");
        return;
      }
      if (route) {
        router.push(route);
        setMessage(`Opening ${route}.`);
        return;
      }

      const active = document.activeElement;
      if (isEditableElement(active)) {
        insertDictation(active, transcript);
        setMessage("Text inserted.");
      } else {
        setMessage(transcript);
      }
    };
    recognition.onerror = (event) => {
      setMessage(event.error ? `Voice input: ${event.error}` : "Voice input stopped.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
    setMessage(resolveLocale() === "fr" ? "J'écoute..." : "Listening...");
  }, [router]);

  useEffect(() => {
    if (!enabled) stop();
    return () => recognitionRef.current?.abort();
  }, [enabled, stop]);

  if (!enabled) return null;

  return (
    <div className="fixed right-4 z-[60] flex flex-col items-end gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}>
      {message && (
        <div role="status" aria-live="polite" className="max-w-[220px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-right text-[12px] text-slate-600 shadow-lg">
          {message}
        </div>
      )}
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={!supported}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition",
          listening ? "bg-red-500 text-white" : "bg-pink-400 text-white",
          !supported && "cursor-not-allowed bg-gray-300 text-white"
        )}
      >
        {listening ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
    </div>
  );
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(readPrefs);

  const setPref = useCallback<AccessibilityContextValue["setPref"]>((key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPrefs(DEFAULT_PREFS);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.a11yTheme = resolveTheme(prefs.theme);
      root.dataset.a11yContrast = prefs.highContrast ? "high" : "normal";
      root.dataset.a11yLargeTargets = prefs.largeTargets ? "true" : "false";
      root.dataset.a11yReduceMotion = prefs.reduceMotion ? "true" : "false";
      root.style.setProperty("--a11y-font-scale", String(Number(prefs.textScale) / 100));
      root.style.setProperty("--a11y-page-zoom", String(Number(prefs.pageZoom) / 100));
      root.style.colorScheme = resolveTheme(prefs.theme);
    };

    apply();
    if (prefs.theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs]);

  useEffect(() => {
    if (!prefs.haptics) return;

    const handler = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("button, a, input, textarea, select, [role='button'], [role='switch']")) return;
      navigator.vibrate?.(12);
    };

    document.addEventListener("pointerup", handler, true);
    return () => document.removeEventListener("pointerup", handler, true);
  }, [prefs.haptics]);

  const value = useMemo(() => ({ prefs, setPref, resetPrefs }), [prefs, setPref, resetPrefs]);

  return (
    <AccessibilityContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
        {children}
        <VoiceAccessButton enabled={prefs.voiceControls} />
        <div id="a11y-live-region" className="sr-only" aria-live="polite" aria-atomic="true" />
      </MotionConfig>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used inside AccessibilityProvider");
  }
  return context;
}
