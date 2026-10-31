"use client";
/**
 * Dictionary + thesaurus client.
 * Data: Olam open datasets, sharded by scripts/build-dictionary.mjs into /dict/*.json.
 * Opposites: Datamuse (English antonyms), mapped to Malayalam through the Olam data.
 */
import { BASE } from "./config";
import { manglishWord } from "@/shared/manglish";
import { transliterate } from "./functions";

interface Sense {
  p: string;
  en: string[][];
  ml: string[][];
}
interface EnEntry {
  h?: string;
  d?: Record<string, string[]>;
  s?: Sense[];
}
interface MlEntry {
  d?: Record<string, string[]>;
  e?: string[];
  r?: [string, number, number][];
}
interface Index {
  version: string;
  mlSplit: string[];
  counts: Record<string, number>;
  sources: { name: string; url: string; license: string }[];
}

export interface LookupResult {
  lang: "en" | "ml";
  query: string;
  /** the headword actually found (may differ from the query after stemming) */
  head: string | null;
  meanings: { pos: string; defs: string[] }[];
  synonyms: string[];
  /** synonyms in the other language (English ↔ Malayalam) */
  translations: string[];
  /** filled asynchronously by `opposites()` */
  related: string[];
}

const ML_RE = /[ഀ-ൿ]/;
let indexP: Promise<Index | null> | null = null;
const shards = new Map<string, Promise<Record<string, unknown> | null>>();

export function loadIndex() {
  indexP ??= fetch(`${BASE}/dict/index.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return indexP;
}

function fetchShard(path: string) {
  let p = shards.get(path);
  if (!p) {
    p = fetch(`${BASE}/dict/${path}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    shards.set(path, p);
  }
  return p;
}

const enShardOf = (k: string) => {
  const a = k[0] && /[a-z]/.test(k[0]) ? k[0] : "_";
  const b = k[1] && /[a-z]/.test(k[1]) ? k[1] : "_";
  return a + b;
};
const hex = (ch: string) => ch.codePointAt(0)!.toString(16);

async function mlShardOf(k: string) {
  const idx = await loadIndex();
  const chars = [...k];
  const first = chars[0] ? hex(chars[0]) : "_";
  if (!idx?.mlSplit.includes(first)) return first;
  return `${first}-${chars[1] ? hex(chars[1]) : "_"}`;
}

export async function getEn(word: string): Promise<EnEntry | null> {
  const k = word.toLowerCase().trim();
  const shard = (await fetchShard(`en/${enShardOf(k)}`)) as Record<string, EnEntry> | null;
  return shard?.[k] ?? null;
}

export async function getMl(word: string): Promise<MlEntry | null> {
  const k = word.trim();
  const shard = (await fetchShard(`ml/${await mlShardOf(k)}`)) as Record<string, MlEntry> | null;
  return shard?.[k] ?? null;
}

/** Headwords starting with `prefix` (for autocomplete). */
export async function suggest(prefix: string, max = 10): Promise<string[]> {
  const p = prefix.trim();
  if (!p) return [];
  const isMl = ML_RE.test(p);
  const key = isMl ? p : p.toLowerCase();
  const shard = isMl ? await fetchShard(`ml/${await mlShardOf(key)}`) : await fetchShard(`en/${enShardOf(key)}`);
  if (!shard) return [];
  const out: string[] = [];
  for (const k of Object.keys(shard)) {
    if (k.startsWith(key)) {
      out.push(isMl ? k : ((shard[k] as EnEntry).h ?? k));
      if (out.length >= max * 4) break;
    }
  }
  return out.sort((a, b) => a.length - b.length).slice(0, max);
}

const EN_STEMS: [RegExp, string][] = [
  [/ies$/, "y"],
  [/ves$/, "f"],
  [/(ss|sh|ch|x|z)es$/, "$1"],
  [/s$/, ""],
  [/ied$/, "y"],
  [/(.)\1ed$/, "$1"],
  [/ed$/, "e"],
  [/ed$/, ""],
  [/(.)\1ing$/, "$1"],
  [/ing$/, "e"],
  [/ing$/, ""],
  [/ly$/, ""],
];

// Common Malayalam case endings / suffixes to strip when the exact word isn't a headword.
const ML_SUFFIXES = ["ുടെ", "ിന്റെ", "ിൻ്റെ", "ന്റെ", "യുടെ", "ിൽ", "ത്തിൽ", "ത്തിന്റെ", "ക്ക്", "ിന്", "ോട്", "ുകൾ", "ങ്ങൾ", "കൾ", "ും", "ോ", "േ", "ാണ്", "ായി", "മായ", "ുന്നു", "ുന്ന", "ിച്ചു", "ി"];

export async function lookup(raw: string): Promise<LookupResult> {
  const query = raw.trim();
  const lang: "en" | "ml" = ML_RE.test(query) ? "ml" : "en";
  const res: LookupResult = { lang, query, head: null, meanings: [], synonyms: [], translations: [], related: [] };
  if (!query) return res;

  if (lang === "en") {
    let head = query.toLowerCase();
    let e = await getEn(head);
    if (!e) {
      for (const [re, rep] of EN_STEMS) {
        if (!re.test(head)) continue;
        const cand = head.replace(re, rep);
        if (cand.length > 1 && (e = await getEn(cand))) {
          head = cand;
          break;
        }
      }
    }
    if (!e) return res;
    res.head = e.h ?? head;
    const ml = new Set<string>();
    for (const [p, defs] of Object.entries(e.d ?? {})) {
      res.meanings.push({ pos: p, defs });
      defs.forEach((d) => ml.add(d));
    }
    const syn = new Set<string>();
    for (const s of e.s ?? []) {
      s.en.flat().forEach((w) => w.toLowerCase() !== head && syn.add(w));
      s.ml.flat().forEach((w) => ml.add(w));
      if (!e.d) res.meanings.push({ pos: s.p, defs: s.ml.map((set) => set.slice(0, 6).join(", ")) });
    }
    res.synonyms = [...syn].slice(0, 40);
    res.translations = [...ml].slice(0, 40);
    return res;
  }

  // Malayalam
  let head = query;
  let m = await getMl(head);
  if (!m) {
    for (const suf of ML_SUFFIXES) {
      if (!head.endsWith(suf) || head.length - suf.length < 2) continue;
      const base = head.slice(0, -suf.length);
      for (const cand of [base, base + "ം", base + "്", base + "ു"]) {
        if ((m = await getMl(cand))) {
          head = cand;
          break;
        }
      }
      if (m) break;
    }
  }
  if (!m) return res;
  res.head = head;
  const syn = new Set<string>();
  for (const [p, defs] of Object.entries(m.d ?? {})) {
    res.meanings.push({ pos: p, defs });
    // short one-word definitions are synonyms too
    defs.forEach((d) => d.split(/[,;]/).map((x) => x.trim()).forEach((x) => x && !/\s/.test(x) && [...x].length <= 18 && x !== head && syn.add(x)));
  }
  // synonyms from E.K. Kurup synsets
  for (const [enHead, si, ji] of m.r ?? []) {
    const e = await getEn(enHead);
    e?.s?.[si]?.ml?.[ji]?.forEach((w) => w !== head && syn.add(w));
  }
  res.synonyms = [...syn].slice(0, 40);
  res.translations = (m.e ?? []).slice(0, 15);
  return res;
}

/** Opposites (വിപരീതം) — English antonyms from Datamuse, translated to Malayalam via Olam. */
export async function opposites(r: LookupResult): Promise<{ word: string; gloss?: string }[]> {
  const english = r.lang === "en" ? [r.head ?? r.query] : r.translations.slice(0, 3);
  if (!english.length) return [];
  const ants = new Set<string>();
  await Promise.all(
    english.map(async (w) => {
      try {
        const res = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(w)}&max=8`);
        const list = (await res.json()) as { word: string }[];
        list.forEach((x) => ants.add(x.word));
      } catch {
        /* offline */
      }
    })
  );
  const words = [...ants].slice(0, 8);
  if (r.lang === "en") return words.map((word) => ({ word }));
  const out: { word: string; gloss?: string }[] = [];
  for (const a of words) {
    const e = await getEn(a);
    const ml = e?.s?.[0]?.ml?.[0]?.slice(0, 2) ?? Object.values(e?.d ?? {})[0]?.slice(0, 2) ?? [];
    ml.forEach((w) => out.push({ word: w, gloss: a }));
  }
  return out.slice(0, 12);
}

/** For a Latin query, the Malayalam words it may have been typed as (Manglish). */
export async function manglishCandidates(q: string): Promise<string[]> {
  if (ML_RE.test(q) || !/^[A-Za-z~_^]+$/.test(q.trim())) return [];
  const r = await transliterate(q.trim(), 4);
  const set = new Set([...(r.candidates ?? []), manglishWord(q.trim())]);
  return [...set].slice(0, 5);
}

export const isMalayalam = (s: string) => ML_RE.test(s);
