/**
 * Dictionary + thesaurus core (dependency-free; shared by the web app and the MCP server).
 * Data: Olam open datasets sharded by scripts/build-dictionary.mjs into /dict/{index,en/*,ml/*}.json
 */

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
    const chars = [...k];
    const f = chars[0] ? hex(chars[0]) : "_";
    if (!idx?.mlSplit?.includes(f)) return `ml/${f}`;
    return `ml/${f}-${chars[1] ? hex(chars[1]) : "_"}`;
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

  async function suggest(prefix: string, max = 10): Promise<string[]> {
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

  async function lookup(raw: string): Promise<LookupResult> {
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
    const syn = new Set<string>();
    for (const [p, defs] of Object.entries(m.d ?? {})) {
      res.meanings.push({ pos: p, defs });
      defs.forEach((d) =>
        d
          .split(/[,;]/)
          .map((x) => x.trim())
          .forEach((x) => x && !/\s/.test(x) && [...x].length <= 18 && x !== head && syn.add(x))
      );
    }
    for (const [enHead, si, ji] of m.r ?? []) {
      const e = await getEn(enHead);
      e?.s?.[si]?.ml?.[ji]?.forEach((w) => w !== head && syn.add(w));
    }
    res.synonyms = [...syn].slice(0, 40);
    res.translations = (m.e ?? []).slice(0, 15);
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

  return { index, getEn, getMl, suggest, lookup, opposites };
}

export const isMalayalam = (s: string) => ML_RE.test(s);
