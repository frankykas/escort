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

/**
 * Read the user's locale from the cookie header in Server Components.
 * Must be called inside a request context (page/layout/route handler).
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const val = jar.get(STORAGE_KEY)?.value;
    if (val === "en" || val === "fr") return val;
  } catch { /* outside request context */ }
  return ENV_LOCALE;
}

/**
 * Returns a translate function bound to the user's server-side locale.
 * Usage: `const t = await getServerT();`
 */
export async function getServerT(): Promise<(key: TranslationKey) => string> {
  const locale = await getServerLocale();
  return (key: TranslationKey) => translations[locale]?.[key] ?? translations.en[key] ?? key;
}
