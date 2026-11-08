/**
 * Rhyme finder (പ്രാസം) over the dictionary's Malayalam headwords.
 *
 * Kinds of rhyme:
 * - "second": ദ്വിതീയാക്ഷര പ്രാസം, the consonant of the second akshara is the same (കാലം, നീലം, ജാലം).
 *   The vowel may differ; matching the first akshara's weight (laghu or guru) is the classical
 *   rule, so such words rank first.
 * - "end": അന്ത്യപ്രാസം, the last akshara is the same (മഴയിൽ, പുഴയിൽ).
 * - "first": ആദിപ്രാസം, the first letter is the same.
 *
 * Data: scripts/build-rhymes.mjs writes /dict/rhyme/<kind letter>-<hex>.json, each a list of words
 * in dictionary order of how well known they are (words with full entries first).
 * Dependency-free: shared by the web app and the MCP server; the phone app ports it in
 * lib/data/rhyme.dart (keep the two in step).
 */
import { aksharas } from "./manglish.ts";

export type RhymeKind = "second" | "end" | "first";
export const RHYME_KINDS: RhymeKind[] = ["second", "end", "first"];

const CLUSTER = /^(?:[ക-ഺ]്[‌‍]?)*[ക-ഺ]/;

/** The consonant (or conjunct) that starts an akshara; an independent vowel stands for itself. */
export function consonantOf(akshara: string): string {
  const m = CLUSTER.exec(akshara);
  return m ? m[0] : [...akshara][0] ?? "";
}

/** The vowel part of an akshara (its vowel sign, or "" for the inherent a). */
export function vowelOf(akshara: string): string {
  const c = consonantOf(akshara);
  return akshara.slice(c.length).replace(/[ംഃ‌‍ൺ-ൿ]/g, "");
}

/** The key a word is filed under for each kind of rhyme. */
export function rhymeKey(word: string, kind: RhymeKind): string | null {
  const a = aksharas(word.trim());
  if (kind === "first") return a[0] ? consonantOf(a[0].text) : null;
  if (kind === "second") return a[1] ? consonantOf(a[1].text) : null;
  return a.length >= 2 ? a[a.length - 1].text : null;
}

const hex = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16)).join("-");
/** Path of a rhyme file under /dict (without .json). */
export const rhymePath = (kind: RhymeKind, key: string) => `rhyme/${kind[0]}-${hex(key)}`;

export interface Rhyme {
  word: string;
  /** "–∪–" pattern: guru and laghu */
  metre: string;
  /** same weight pattern as the asked word (fits the same place in the line) */
  sameMetre: boolean;
}

export interface RhymeOptions {
  max?: number;
  /** only words with the same number of aksharas */
  sameLength?: boolean;
  /** only words with the same laghu–guru pattern */
  sameMetre?: boolean;
}

/**
 * Order the candidates from a rhyme file for one word: the file's own order (well-known words
 * first), lifted when the word also matches the vowel, the first akshara's weight, the length
 * and the metre of the asked word.
 */
export function rankRhymes(word: string, kind: RhymeKind, candidates: string[], opts: RhymeOptions = {}): Rhyme[] {
  const q = aksharas(word.trim());
  if (!q.length) return [];
  const qMetre = q.map((x) => (x.long ? "–" : "∪")).join("");
  const n = candidates.length || 1;
  const out: { r: Rhyme; s: number }[] = [];
  candidates.forEach((w, i) => {
    if (w === word) return;
    const a = aksharas(w);
    if (!a.length) return;
    const metre = a.map((x) => (x.long ? "–" : "∪")).join("");
    const sameMetre = metre === qMetre;
    if (opts.sameLength && a.length !== q.length) return;
    if (opts.sameMetre && !sameMetre) return;
    let s = 1 - i / n;
    if (a.length === q.length) s += 0.3;
    if (sameMetre) s += 0.5;
    if (kind === "second") {
      if (a[0].long === q[0].long) s += 0.6;
      if (a[1] && q[1] && vowelOf(a[1].text) === vowelOf(q[1].text)) s += 0.3;
    } else if (kind === "end") {
      const pa = a[a.length - 2];
      const pq = q[q.length - 2];
      if (pa && pq && vowelOf(pa.text) === vowelOf(pq.text)) s += 0.4;
      if (pa && pq && pa.text === pq.text) s += 0.6;
    } else if (a[0].text === q[0].text) s += 0.3;
    out.push({ r: { word: w, metre, sameMetre }, s });
  });
  return out
    .sort((x, y) => y.s - x.s)
    .slice(0, opts.max ?? 60)
    .map((x) => x.r);
}

/** For a line of verse: the word whose rhyme matters for each kind (whole line for the second akshara). */
export function rhymeSource(line: string, kind: RhymeKind): string {
  const words = line.trim().split(/\s+/).filter((w) => /[ഀ-ൿ]/.test(w));
  if (!words.length) return "";
  if (kind === "end") return words[words.length - 1].replace(/[^ഀ-ൿ‌‍]/g, "");
  if (kind === "first") return words[0].replace(/[^ഀ-ൿ‌‍]/g, "");
  // the second akshara of the line may sit in the second word when the first is one akshara
  const first = words[0].replace(/[^ഀ-ൿ‌‍]/g, "");
  if (aksharas(first).length >= 2) return first;
  return (first + (words[1] ?? "")).replace(/[^ഀ-ൿ‌‍]/g, "");
}

/** Fetch a JSON file relative to the /dict root; null when missing. */
export type RhymeFetch = (path: string) => Promise<unknown | null>;

export function createRhymes(fetchJson: RhymeFetch) {
  const cache = new Map<string, Promise<string[]>>();
  const file = (kind: RhymeKind, key: string) => {
    const p = rhymePath(kind, key);
    let f = cache.get(p);
    if (!f) {
      f = fetchJson(p)
        .then((j) => (Array.isArray(j) ? (j as string[]) : []))
        .catch(() => []);
      cache.set(p, f);
    }
    return f;
  };
  /** Rhymes for a word (Malayalam script). */
  async function find(word: string, kind: RhymeKind, opts: RhymeOptions = {}): Promise<Rhyme[]> {
    const key = rhymeKey(word, kind);
    if (!key) return [];
    return rankRhymes(word, kind, await file(kind, key), opts);
  }
  return { find };
}
