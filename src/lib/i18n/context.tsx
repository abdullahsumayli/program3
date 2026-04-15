"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getTranslation, type Locale } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "app-locale";

function getStoredLocale(fallback: Locale) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "ar" ? saved : fallback;
}

export function LanguageProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const locale = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === STORAGE_KEY) {
          callback();
        }
      };

      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    },
    () => getStoredLocale(initialLocale),
    () => initialLocale
  );

  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: next }),
    }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => getTranslation(locale, key, params),
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, dir: locale === "ar" ? "rtl" : "ltr", setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
