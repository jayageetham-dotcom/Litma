import { scriptKey, latinKeys, outline } from "./skeleton.ts";
import { manglishWord, manglishCandidates, COMMON } from "/home/claude/litma/packages/shared/src/manglish.ts";

export interface Entry { w: string; s: string; f: number } // word, skeleton, log-frequency rank score
export type Index = Map<string, Entry[]>;

export function buildIndex(words: [string, number][]): Index {
  const idx: Index = new Map();
  for (const [w, f] of words) {
    const s = scriptKey(w);
    if (!s) continue;
    const o = outline(s);
    let b = idx.get(o);
    if (!b) idx.set(o, (b = []));
    b.push({ w, s, f: Math.log(f) });
  }
  return idx;
}

const VOW = new Set("aeiou");
const NEAR = new Set(["kg", "gk", "pb", "bp", "cj", "jc", "nJ", "Jn"]);
/** Edit distance on skeletons: vowel slips are cheap, consonant slips dear. */
function skelDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j ? prev[j - 1] + (VOW.has(b[j - 1]) ? 0.5 : 1) : 0;
  for (let i = 1; i <= m; i++) {
    cur[0] = prev[0] + (VOW.has(a[i - 1]) ? 0.5 : 1);
    for (let j = 1; j <= n; j++) {
      const x = a[i - 1], y = b[j - 1];
      const sub = x === y ? 0 : (VOW.has(x) && VOW.has(y)) || NEAR.has(x + y) ? 0.5 : 1;
      cur[j] = Math.min(prev[j - 1] + sub, prev[j] + (VOW.has(x) ? 0.5 : 1), cur[j - 1] + (VOW.has(y) ? 0.5 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
/** Plain edit distance on code points (literal reading vs candidate). */
function lev(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = B.map((_, j) => j + 1); prev.unshift(0);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
    prev = cur;
  }
  return prev[B.length];
}

export const W = { skel: 2.0, lit: 0.3, freq: 0.2, maxSkel: 1.5 };

export interface Scored { w: string; score: number }

/** Known words that fit a Manglish word, best first. */
export function lookup(idx: Index, word: string, max = 8): Scored[] {
  const keys = latinKeys(word);
  const literal = manglishWord(word);
  const seen = new Map<string, Scored>();
  for (const o of new Set(keys.map(outline))) {
    for (const e of idx.get(o) ?? []) {
      if (seen.has(e.w)) continue;
      let d = Infinity;
      for (const k of keys) d = Math.min(d, skelDist(k, e.s) + (VOW.has(k[0]) === VOW.has(e.s[0]) ? 0 : 1));
      if (d > W.maxSkel) continue;
      const score = -W.skel * d - W.lit * lev(literal, e.w) + W.freq * e.f;
      seen.set(e.w, { w: e.w, score });
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** Final suggestion list: known words first, then the rule readings (never dropped). */
export function suggest(idx: Index, word: string, max = 6): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (s && !out.includes(s)) out.push(s); };
  // Litma's own fixed spellings win; fragments, digits and punctuation are never swapped
  if (Object.prototype.hasOwnProperty.call(COMMON, word)) add(COMMON[word]);
  // mid-word clusters typed on their own (ngal, mpi, rr) are pieces, not words
  if (!/^[A-Za-z]{3,}$/.test(word) || /^(ng|nk|mp|nt|nd|nch|nth|rr|thh)/.test(word)) {
    for (const c of manglishCandidates(word, max)) add(c);
    return out.slice(0, max);
  }
  // capitals, ~ or _ mean the writer is spelling exactly (Mozhi style): their reading leads
  if (/[A-Z~_^]/.test(word)) add(manglishWord(word));
  for (const s of lookup(idx, word, max)) add(s.w);
  for (const c of manglishCandidates(word, max)) add(c);
  // the plain reading always stays in view
  const lit = manglishWord(word);
  if (!out.slice(0, max).includes(lit)) out.splice(max - 1, 0, lit);
  return out.slice(0, max);
}
