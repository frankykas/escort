import { en, type TranslationKey } from "./en";
import { fr } from "./fr";

export type { TranslationKey };
export type Locale = "en" | "fr";

export const STORAGE_KEY = "cleopatra_locale";

const translations = { en, fr } as const;

/** Build-time default from env var. Falls back to "en". */
export const ENV_LOCALE = (process.env.NEXT_PUBLIC_LOCALE ?? "en") as Locale;

/**
 * Translate a key. Safe to call in Server Components and Client Components.
 * For a reactive hook version (locale-switcher aware), use useTranslation() instead.
 */
export function t(key: TranslationKey, locale: Locale = ENV_LOCALE): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}
