"use client";
import { Check } from "lucide-react";
import { LOCALES, useI18n, type Locale } from "@/i18n/react";

/** App language (menus and buttons). Writing is never translated. */
export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <section>
      <h2 className="text-xl font-semibold">{t("settings.language")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t("settings.languageHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t("settings.uiLanguage")}>
        {(Object.keys(LOCALES) as Locale[]).map((code) => {
          const on = code === locale;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={on}
              lang={code}
              onClick={() => setLocale(code)}
              className={`flex min-w-36 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${on ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface hover:bg-subtle"}`}
            >
              <span>
                <span className="block font-semibold">{LOCALES[code].native}</span>
                <span className={`block text-xs ${on ? "text-accent" : "text-muted"}`}>{LOCALES[code].name}</span>
              </span>
              {on && <Check size={16} aria-hidden />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
