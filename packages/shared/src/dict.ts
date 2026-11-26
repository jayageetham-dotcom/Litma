/**
 * Dictionary + thesaurus core (dependency-free; shared by the web app and the MCP server).
 * Data: Olam open datasets sharded by scripts/build-dictionary.mjs into /dict/{index,en/*,ml/*}.json
 */

import { firstAksharaLength } from "./akshara.ts";

export interface Sense {
  p: string;
  en: string[][];
  ml: string[][];
}
export interface EnEntry {
  h?: string;
  d?: Record<string, string[]>;
  s?: Sense[];
}
export interface MlEntry {
  d?: Record<string, string[]>;
  e?: string[];
  r?: [string, number, number][];
}
export interface DictIndex {
  version: string;
  format?: number;
  enSplit?: string[];
  mlSplit: string[];
  counts: Record<string, number>;
  sources: { name: string; url: string; license: string }[];
}
export interface LookupResult {
  lang: "en" | "ml";
  query: string;
  head: string | null;
  meanings: { pos: string; defs: string[] }[];
  synonyms: string[];
  translations: string[];
  related: string[];
}

/** Fetch a JSON file relative to the /dict root (e.g. "index", "en/h", "ml/d38"); null when missing. */
export type DictFetch = (path: string) => Promise<unknown | null>;

const ML_RE = /[ഀ-ൿ]/;

const CHILLU: Record<string, string> = { "ന": "ൻ", "ണ": "ൺ", "ര": "ർ", "ല": "ൽ", "ള": "ൾ", "ക": "ൿ" };

/**
 * Ways to spell a typed word for the dictionary, as typed first. Some keyboards put an invisible
 * joiner (U+200C / U+200D) after ് (കാട് + U+200C), or type a chillu as consonant + ് + U+200D;
 * the dictionary mostly has the plain or atomic form, but some old spellings keep the joiner, so the
 * word as typed is always tried first.
 */
export function spellings(raw: string): string[] {
  const w = raw.trim();
  if (!ML_RE.test(w)) return [w];
  const n = w.normalize("NFC");
  const chillu = n.replace(/([നണരലളക])\u0D4D\u200D/g, (_, c: string) => CHILLU[c]);
  return [...new Set([w, n, chillu, chillu.replace(/[\u200C\u200D]/g, ""), n.replace(/[\u200C\u200D]/g, "")])];
}
const hex = (ch: string) => ch.codePointAt(0)!.toString(16);

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
const ML_SUFFIXES = ["ുടെ", "ിന്റെ", "ിൻ്റെ", "ന്റെ", "യുടെ", "ിൽ", "ത്തിൽ", "ത്തിന്റെ", "ക്ക്", "ിന്", "ോട്", "ുകൾ", "ങ്ങൾ", "കൾ", "ും", "ോ", "േ", "ാണ്", "ായി", "മായ", "ുന്നു", "ുന്ന", "ിച്ചു", "ി"];

/** The shard a Malayalam headword lives in (same name under ml/ and words/). */
export function mlShardName(k: string, mlSplit: string[]): string {
  const chars = [...k];
  const f = chars[0] ? hex(chars[0]) : "_";
  if (!mlSplit.includes(f)) return f;
  return `${f}-${chars[1] ? hex(chars[1]) : "_"}`;
}


/** Word endings → the dictionary form they come from (verbs to -ുക, plurals to -ൻ, a doubled final consonant). */
const FORM_RULES: [RegExp, string][] = [
  [/യ(?:ിൽ|ിലെ|ിലും|ിലേക്ക്|ുടെ|ും|െ|ോട്|്ക്ക്|്ക്കും|ാണ്)$/, ""], // മഴയിൽ → മഴ, കഥയുടെ → കഥ
  [/ഞ്ഞു?$/, "യുക"], // മുറിഞ്ഞു → മുറിയുക, കരഞ്ഞ → കരയുക
  [/(?:ുന്നു|ുന്നതും|ുന്നത്|ുന്ന|ുമ്പോൾ|ുകയും|ുകയാണ്|ുകയായിരുന്നു|ുമെന്ന്|ും|ാൻ|ണം|ാം)$/, "ുക"], // കാണുന്നു → കാണുക
  [/ിച്ചു$|ിച്ച$|ിച്ച്$/, "ിക്കുക"], // സഹായിച്ചു → സഹായിക്കുക
  [/ാർ$/, "ാരൻ"], // തടവുകാർ → തടവുകാരൻ
  [/ർ$/, "ൻ"],
  [/([ക-ഹ])്\1െ$/, "$1്"], // കോഴിക്കോട്ടെ → കോഴിക്കോട്
];

export function createDictionary(fetchJson: DictFetch) {
  const cache = new Map<string, Promise<unknown | null>>();
  const get = (path: string) => {
    let p = cache.get(path);
    if (!p) {
      p = fetchJson(path).catch(() => null);
      cache.set(path, p);
    }
    return p;
  };
  const index = () => get("index") as Promise<DictIndex | null>;

  async function enShard(k: string) {
    const idx = await index();
    const f = k[0] && /[a-z]/.test(k[0]) ? k[0] : "_";
    const s = k[1] && /[a-z]/.test(k[1]) ? k[1] : "_";
    if (!idx?.format) return `en/${f}${s}`; // first-generation two-letter shards
    return idx.enSplit?.includes(f) ? `en/${f}-${s}` : `en/${f}`;
  }
  async function mlShard(k: string) {
    const idx = await index();
    return `ml/${mlShardName(k, idx?.mlSplit ?? [])}`;
  }

  async function getEn(word: string): Promise<EnEntry | null> {
    const k = word.toLowerCase().trim();
    if (!k) return null;
    const shard = (await get(await enShard(k))) as Record<string, EnEntry> | null;
    return shard?.[k] ?? null;
  }
  async function getMl(word: string): Promise<MlEntry | null> {
    const k = word.trim();
    if (!k) return null;
    const shard = (await get(await mlShard(k))) as Record<string, MlEntry> | null;
    return shard?.[k] ?? null;
  }

  async function suggestExact(prefix: string, max = 10): Promise<string[]> {
    const p = prefix.trim();
    if (!p) return [];
    const isMl = ML_RE.test(p);
    const key = isMl ? p : p.toLowerCase();
    const shard = (await get(isMl ? await mlShard(key) : await enShard(key))) as Record<string, EnEntry> | null;
    if (!shard) return [];
    const out: string[] = [];
    for (const k of Object.keys(shard)) {
      if (k.startsWith(key)) {
        out.push(isMl ? k : (shard[k].h ?? k));
        if (out.length >= max * 4) break;
      }
    }
    return out.sort((a, b) => a.length - b.length).slice(0, max);
  }

  async function lookupExact(raw: string): Promise<LookupResult> {
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
    // Rank synonyms so the closest words come first (കാട് → വനം, അടവി, കാനനം… before rare or
    // far-off senses). Each Malayalam word scores from every thesaurus set it appears in, weighted by
    // how good that set's English headword is as a translation (Olam lists the best translations
    // first in `e`), so words shared by several strong sets rise to the top.
    const score = new Map<string, { s: number; order: number }>();
    let order = 0;
    const add = (w: string, weight: number) => {
      if (!w || w === head) return;
      const cur = score.get(w);
      if (cur) cur.s += weight;
      else score.set(w, { s: weight, order: order++ });
    };
    for (const [p, defs] of Object.entries(m.d ?? {})) {
      res.meanings.push({ pos: p, defs });
      // short comma-separated glosses in the definitions; the first sense counts most.
      // "പ്ര." holds usage examples and idioms, not synonyms.
      if (p.startsWith("പ്ര")) continue;
      defs.forEach((d, di) =>
        d
          .split(/[,;]/)
          .map((x) => x.trim())
          .forEach((x) => x && !/\s/.test(x) && [...x].length <= 18 && add(x, 0.5 / (1 + di)))
      );
    }
    const enRank = new Map((m.e ?? []).map((w, i) => [w.toLowerCase(), i]));
    const refs = [...(m.r ?? [])].sort((a, b) => (enRank.get(a[0].toLowerCase()) ?? 99) - (enRank.get(b[0].toLowerCase()) ?? 99));
    for (const [enHead, si, ji] of refs) {
      const e = await getEn(enHead);
      const set = e?.s?.[si]?.ml?.[ji];
      if (!set) continue;
      const w = 1 / (1 + (enRank.get(enHead.toLowerCase()) ?? 20)) ** 1.5;
      // within a set the first words are the plainest; huge sets (fire has 400 epithets) count less each
      const damp = set.length > 60 ? 0.5 : 1;
      set.forEach((x, i) => add(x, w * damp * (i < 12 ? 1 : 0.5)));
    }
    const words = (w: string) => w.split(/\s+/).length;
    res.synonyms = [...score.entries()]
      .sort(([a, x], [b, y]) => {
        // single words before phrases, then by score, then shorter, then first seen
        const pa = words(a) > 1 ? 1 : 0;
        const pb = words(b) > 1 ? 1 : 0;
        if (pa !== pb) return pa - pb;
        if (Math.abs(y.s - x.s) > 1e-9) return y.s - x.s;
        if ([...a].length !== [...b].length) return [...a].length - [...b].length;
        return x.order - y.order;
      })
      .map(([w]) => w)
      .slice(0, 40);
    // the sources number homographs ("mum-1", "hail-2"); writers see the plain word once
    res.translations = [...new Set((m.e ?? []).map((w) => w.replace(/-\d+$/, "")))].slice(0, 15);
    return res;
  }

  /** Opposites: English antonyms from Datamuse, translated to Malayalam through Olam for Malayalam words. */
  async function opposites(r: LookupResult): Promise<{ word: string; gloss?: string }[]> {
    const english = r.lang === "en" ? [r.head ?? r.query] : r.translations.slice(0, 3);
    if (!english.length) return [];
    const ants = new Set<string>();
    await Promise.all(
      english.map(async (w) => {
        try {
          const res = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(w)}&max=8`);
          ((await res.json()) as { word: string }[]).forEach((x) => ants.add(x.word));
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

  /** Words starting with `prefix`; a Malayalam prefix typed with stray joiners is tried cleaned up too. */
  async function suggest(prefix: string, max = 10): Promise<string[]> {
    for (const p of spellings(prefix)) {
      const out = await suggestExact(p, max);
      if (out.length) return out;
    }
    return [];
  }

  /** Looks a word up as typed, then (Malayalam only) as {@link spellings} cleans it up. */
  async function lookup(raw: string): Promise<LookupResult> {
    const first = await lookupExact(raw);
    if (first.head) return first;
    for (const w of spellings(raw).slice(1)) {
      const r = await lookupExact(w);
      if (r.head) return { ...r, query: first.query };
    }
    return first;
  }

  /**
   * The dictionary word to open for a Malayalam word that has no entry of its own, such as a rhyme
   * like കാണുന്നു or മുറിഞ്ഞു: the word or its plain form when {@link lookup} finds one, then the
   * verb or noun it is a form of (കാണുക, മുറിയുക, തടവുകാരൻ, കോഴിക്കോട്), then the longest
   * headword it starts with that covers most of it. Null when none is close enough (better no
   * meaning than a wrong one: കോഴിക്കോട്ടെ is not കോഴി).
   */
  async function headFor(word: string): Promise<string | null> {
    const w = word.trim();
    if (!ML_RE.test(w)) return null;
    if (await getMl(w)) return w;
    // a particle at the end (കഥകളൊക്കെ, ചിലരൊക്കെ): look up the word before it
    const bare = w.replace(/([ളരലനണ])ൊക്കെ$/, (_, c: string) => CHILLU[c]).replace(/ൊക്കെ$/, "്");
    if (bare !== w) return headFor(bare);
    for (const [end, add] of FORM_RULES) {
      const m = end.exec(w);
      if (!m || m.index < 2) continue;
      const cand = w.slice(0, m.index) + add.replace("$1", m[1] ?? "");
      if (cand !== w && (await getMl(cand))) return cand;
    }
    const r = await lookup(w);
    if (r.head) return r.head;
    const ends: number[] = [];
    for (let i = 0; i < w.length; ) {
      i += firstAksharaLength(w.slice(i)) || 1;
      ends.push(i);
    }
    const least = Math.max(2, Math.ceil(ends.length * 0.6));
    for (let k = ends.length - 1; k >= least; k--) {
      const base = w.slice(0, ends[k - 1]);
      for (const cand of [base, base + "്", base + "ം"]) if (await getMl(cand)) return cand;
    }
    return null;
  }

  return { index, getEn, getMl, suggest, lookup, opposites, headFor };
}

export const isMalayalam = (s: string) => ML_RE.test(s);
