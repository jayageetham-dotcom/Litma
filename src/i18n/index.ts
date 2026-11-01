/**
 * Litma i18n: one JSON message file per language in ./locales.
 *
 *  - en.json is the source of truth; every other language may leave keys out and falls back to English.
 *  - The JSON files are plain data so the Electron and Flutter apps can load the same strings.
 *  - Adding a language (Tamil, Hindi, Kannada…): copy en.json to <code>.json, translate, and add it to LOCALES below.
 *  - Placeholders: {name}. Plurals: key_one / key_other, chosen with Intl.PluralRules from {count}.
 */
import en from "./locales/en.json";
import ml from "./locales/ml.json";

export type Messages = typeof en;

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type StripPlural<K extends string> = K extends `${infer B}_one` | `${infer B}_other` ? B : K;
/** Every message key, e.g. "desk.newWork" or "common.words" (plural base). */
export type MessageKey = StripPlural<Leaves<Messages>>;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

export const LOCALES = {
  en: { name: "English", native: "English", dir: "ltr", messages: en as DeepPartial<Messages> },
  ml: { name: "Malayalam", native: "മലയാളം", dir: "ltr", messages: ml as DeepPartial<Messages> },
  // Next: ta (தமிழ்), kn (ಕನ್ನಡ), te (తెలుగు), hi (हिन्दी), bn (বাংলা)… add a JSON file and a line here.
} as const;
export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = "en";
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && v in LOCALES;

function lookup(tree: unknown, key: string): string | undefined {
  let cur: unknown = tree;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const msgs = LOCALES[locale]?.messages ?? LOCALES.en.messages;
  let k: string = key;
  if (params && typeof params.count === "number") {
    const form = new Intl.PluralRules(locale).select(params.count) === "one" ? "one" : "other";
    k = `${key}_${form}`;
  }
  const raw = lookup(msgs, k) ?? lookup(LOCALES.en.messages, k) ?? lookup(msgs, key) ?? lookup(LOCALES.en.messages, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    if (v == null) return m;
    return typeof v === "number" ? v.toLocaleString(locale === "en" ? "en-IN" : locale) : v;
  });
}
