"use client";

import { useState, useCallback } from "react";
import { en, type TranslationKey } from "./en";
import { fr } from "./fr";
import { STORAGE_KEY, ENV_LOCALE, type Locale } from "./index";

const translations = { en, fr } as const;

/**
 * Read locale synchronously so every component mount starts with the
 * stored preference — no flash of the wrong language between navigations.
 */
function resolveLocale(): Locale {
  if (typeof window === "undefined") return ENV_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "en" || stored === "fr") return stored;
  } catch { /* SSR / restricted storage */ }
  return ENV_LOCALE;
}

export function useTranslation() {
  // Initialise directly from localStorage (synchronous) so the first
  // render already uses the persisted locale — no useEffect needed.
  const [locale, setLocaleState] = useState<Locale>(resolveLocale);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    // Also set a cookie so server components can read the locale
    document.cookie = `${STORAGE_KEY}=${next};path=/;max-age=31536000;SameSite=Lax`;
    setLocaleState(next);
    window.location.reload();
  }, []);

  const translate = useCallback(
    (key: TranslationKey): string =>
      translations[locale]?.[key] ?? translations.en[key] ?? key,
    [locale]
  );

  return { t: translate, locale, setLocale };
}
