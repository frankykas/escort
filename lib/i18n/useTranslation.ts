"use client";

import { useState, useEffect, useCallback } from "react";
import { en, type TranslationKey } from "./en";
import { fr } from "./fr";
import { STORAGE_KEY, ENV_LOCALE, type Locale } from "./index";

const translations = { en, fr } as const;

function resolveLocale(): Locale {
  if (typeof window === "undefined") return ENV_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "en" || stored === "fr") return stored;
  return ENV_LOCALE;
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(ENV_LOCALE);

  useEffect(() => {
    setLocaleState(resolveLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
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
