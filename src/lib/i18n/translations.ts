import en from "../../../public/locales/en.json";
import ar from "../../../public/locales/ar.json";

export type Locale = "en" | "ar";
export type Translations = typeof en;

export const translations: Record<Locale, Translations> = { en, ar };

export function getTranslation(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const parts = key.split(".");
  let value: unknown = translations[locale];
  for (const part of parts) {
    if (typeof value === "object" && value !== null && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  let result = typeof value === "string" ? value : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}
