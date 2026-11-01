"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, isLocale, translate, type Locale, type MessageKey, type Params } from "@litma/i18n";

const STORAGE_KEY = "litma:locale";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: MessageKey, params?: Params) => string };
const I18nContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
});

function readStored(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isLocale(v)) return v;
  } catch {
    /* storage may be unavailable */
  }
  return DEFAULT_LOCALE;
}

/** Wrap the app once (in the root layout). The choice is per device, kept in localStorage. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  // static export: render English first, then switch to the stored language after hydration
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => setLocaleState(readStored()), []);
  useEffect(() => {
    document.documentElement.dataset.uiLocale = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(() => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
export { LOCALES };
export type { Locale, MessageKey };
