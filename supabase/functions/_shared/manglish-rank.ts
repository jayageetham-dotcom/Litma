/**
 * Ranked offline Manglish suggestions: which real Malayalam words a Manglish word stands for.
 *
 * manglish.ts spells letter by letter, so on its own "enthaanu" becomes എന്താനു. This module adds
 * a word list (most used first, one word per line; built by scripts/build-manglish-words.mjs) and
 * finds the words that sound like what was typed:
 *
 * - Every word gets a loose sound skeleton (ന/ണ, ല/ള, ര/റ, ത/ട/ദ, long and short vowels, doubled
 *   letters and a final u or ് fall together), indexed by its consonant outline.
 * - The Manglish word gives a few skeletons of its own (ee may be ഈ or ഏ, an English c before e/i is s…).
 * - Words in the same outline are scored by how close their skeleton is, how close they are to the
 *   plain letter reading, the vowel lengths the writer typed, and how common they are.
 *
 * Writers invent words, so nothing is forced: when no real word fits closely the plain reading
 * leads, and it always stays in the first six. Capitals, ~ and _ (spelling exactly), Litma's own
 * fixed words (COMMON), pieces of words and anything with digits or punctuation keep today's
 * suggestions. Online, Google's list still comes first; this is the offline list.
 *
 * Phone app: lib/core/manglish_rank.dart must give the same answers (test/manglish_rank_vectors.json).
 */
import { COMMON, exactReading, manglishCandidates, manglishWord } from "./manglish.ts";

// ---------------------------------------------------------------- sound skeleton

const VIRAMA = "്";
const SIGN: Record<string, string> = {
  "ാ": "a", "ി": "i", "ീ": "i", "ു": "u", "ൂ": "u", "ൃ": "ri", "െ": "e", "േ": "e",
  "ൈ": "ai", "ൊ": "o", "ോ": "o", "ൌ": "au", "ൗ": "au",
};
const IND: Record<string, string> = {
  "അ": "a", "ആ": "a", "ഇ": "i", "ഈ": "i", "ഉ": "u", "ഊ": "u", "ഋ": "ri", "എ": "e", "ഏ": "e",
  "ഐ": "ai", "ഒ": "o", "ഓ": "o", "ഔ": "au",
};
const CONS: Record<string, string> = {
  "ക": "k", "ഖ": "k", "ഗ": "g", "ഘ": "g", "ങ": "n",
  "ച": "c", "ഛ": "c", "ജ": "j", "ഝ": "j", "ഞ": "J",
  "ട": "t", "ഠ": "t", "ഡ": "t", "ഢ": "t", "ണ": "n",
  "ത": "t", "ഥ": "t", "ദ": "t", "ധ": "t", "ന": "n",
  "പ": "p", "ഫ": "p", "ബ": "b", "ഭ": "b", "മ": "m",
  "യ": "y", "ര": "r", "റ": "r", "ല": "l", "ള": "l", "വ": "v",
  "ശ": "s", "ഷ": "s", "സ": "s", "ഹ": "h", "ഴ": "z",
};
const CHILLU: Record<string, string> = {
  "ൻ": "n", "ൺ": "n", "ൽ": "l", "ൾ": "l", "ർ": "r", "ൿ": "k", "ൔ": "m", "ൕ": "y", "ൖ": "z", "ം": "m", "ഃ": "h",
};

function squeeze(s: string): string {
  return s
    .replace(/(.)\1+/g, "$1") // doubled letters
    .replace(/[nm](?=[^aeiouyJ])/g, "n") // ം, n or m before a consonant
    .replace(/(?<=[ie])y(?=[aeiou])/g, "") // glide: koriyan = korean
    .replace(/(?<=[^aeiou])u$/, ""); // a final u or half-u
}

/** Sound skeleton of a word in Malayalam script. */
export function scriptKey(word: string): string {
  const ch = [...word.replace(/[‌‍]/g, "")];
  let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (CONS[c]) {
      let k = CONS[c];
      const prev = ch[i - 1], prev2 = ch[i - 2];
      // ന്റ and റ്റ are typed nt and tt
      if (c === "റ" && prev === VIRAMA && (prev2 === "ന" || prev2 === "റ")) k = "t";
      if (c === "റ" && ch[i + 1] === VIRAMA && ch[i + 2] === "റ") k = "t";
      // ങ്ങ is typed ng
      if (c === "ങ" && ch[i + 1] === VIRAMA && ch[i + 2] === "ങ") {
        out += "ng";
        i += 2;
        continue;
      }
      // ജ്ഞ is typed jn, ഞ്ച nch
      if (c === "ഞ" && prev === VIRAMA && prev2 === "ജ") k = "n";
      if (c === "ഞ" && ch[i + 1] === VIRAMA && ch[i + 2] === "ച") k = "n";
      out += k;
      const nx = ch[i + 1];
      if (nx === VIRAMA) {
        i++;
        continue;
      }
      if (nx && SIGN[nx]) {
        out += SIGN[nx];
        i++;
        continue;
      }
      out += "a";
      continue;
    }
    if (IND[c]) out += IND[c];
    else if (CHILLU[c]) out += CHILLU[c];
    else if (SIGN[c]) out += SIGN[c];
  }
  return squeeze(out);
}

/** Consonant outline of a skeleton: the index key (vowels are scored, not matched). */
export function outline(skel: string): string {
  return skel.replace(/[aeiouy]/g, "").replace(/g/g, "k").replace(/b/g, "p").replace(/z/g, "r");
}

// Manglish → skeleton. First match wins, so longer keys come first; some spellings branch.
const LAT: [string, string[]][] = [
  ["chh", ["c"]], ["ksh", ["ks"]], ["nch", ["nc"]], ["nth", ["nt"]],
  ["ng", ["ng", "n"]], ["nk", ["nk"]], ["nj", ["J", "nc"]], ["ny", ["J", "ny"]], ["cch", ["c"]],
  ["th", ["t"]], ["dh", ["t"]], ["kh", ["k"]], ["gh", ["g"]], ["ch", ["c"]], ["jh", ["j"]],
  ["sh", ["s"]], ["zh", ["z"]], ["ph", ["p"]], ["bh", ["b"]],
  ["aa", ["a"]], ["ee", ["i", "e"]], ["ii", ["i"]], ["oo", ["u", "o"]], ["uu", ["u"]],
  ["ae", ["e"]], ["ai", ["ai"]], ["ei", ["ai"]], ["ou", ["au"]], ["au", ["au", "o"]], ["oa", ["o"]],
  ["x", ["ks"]], ["q", ["k"]], ["f", ["p"]], ["w", ["v"]], ["z", ["s", "z"]], ["d", ["t"]],
  ["a", ["a"]], ["e", ["e"]], ["i", ["i"]], ["o", ["o"]], ["u", ["u"]],
  ["k", ["k"]], ["g", ["g"]], ["c", ["c", "k"]], ["j", ["j"]], ["t", ["t"]], ["n", ["n"]],
  ["p", ["p"]], ["b", ["b"]], ["m", ["m"]], ["y", ["y"]], ["Y", ["y", "i"]], ["r", ["r"]], ["l", ["l"]],
  ["v", ["v"]], ["s", ["s"]], ["h", ["h"]],
];

/** The skeletons a Manglish word may stand for (a handful at most). */
export function latinKeys(word: string, limit = 16): string[] {
  const w = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/c[ck](?!h)/g, "k")
    .replace(/c(?=[eiy])/g, "s") // English: officer, license, cylinder
    .replace(/tion/g, "shan")
    .replace(/(?<=[^aeiou][^aeiou]?)e$/, "") // a silent final e: license
    // y before a consonant or at the end: the consonant യ് (പെയ്തു, നായ്) or the vowel of ai (മൈ)
    .replace(/y(?![aeiou])/g, "Y");
  let acc = [""];
  let i = 0;
  while (i < w.length) {
    const hit = LAT.find(([k]) => w.startsWith(k, i));
    if (!hit) {
      i++;
      continue;
    }
    // a stray h after a consonant (krishhna) adds nothing
    if (hit[0] === "h" && i > 0 && !/[aeiou]/.test(w[i - 1])) {
      i++;
      continue;
    }
    const next: string[] = [];
    for (const a of acc) for (const v of hit[1]) next.push(a + v);
    acc = next.slice(0, limit);
    i += hit[0].length;
  }
  return [...new Set(acc.map(squeeze))];
}

const LONG = new Set(["ാ", "ീ", "ൂ", "േ", "ോ", "ആ", "ഈ", "ഊ", "ഏ", "ഓ", "ൈ", "ൗ", "ൌ", "ഐ", "ഔ"]);
const SHORT = new Set(["ി", "ു", "െ", "ൊ", "ൃ", "അ", "ഇ", "ഉ", "എ", "ഒ", "ഋ"]);

/** Vowel lengths written in a word (S short, L long), e.g. താരാ → "SL"; a final short one is left out. */
export function scriptLengths(word: string): string {
  const ch = [...word];
  let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (LONG.has(c)) out += "L";
    else if (SHORT.has(c)) out += "S";
    else if (CONS[c]) {
      const nx = ch[i + 1];
      if (!nx || (!LONG.has(nx) && !SHORT.has(nx) && nx !== VIRAMA)) out += "S"; // the inherent a
    }
  }
  return out.replace(/S$/, "");
}

/** Vowel lengths the writer typed (aa, ee, oo… are long). */
export function latinLengths(word: string): string {
  const groups = word.toLowerCase().match(/[aeiou]+/g) ?? [];
  const out = groups.map((g) => (g.length > 1 && !/^(ai|au|ou|ei|ia|io|iu|ua|ue|ui|eo|ea|oe)$/.test(g) ? "L" : "S")).join("");
  return out.replace(/S$/, "");
}

// ---------------------------------------------------------------- distances

const VOW = new Set(["a", "e", "i", "o", "u"]);
const NEAR = new Set(["kg", "gk", "pb", "bp", "cj", "jc", "nJ", "Jn"]);
const cost = (c: string) => (VOW.has(c) ? 0.5 : 1);

/** Edit distance between skeletons: a vowel slip costs half a consonant slip. */
function skelDist(a: string, b: string): number {
  const n = b.length;
  let prev: number[] = [0];
  for (let j = 1; j <= n; j++) prev[j] = prev[j - 1] + cost(b[j - 1]);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [prev[0] + cost(a[i - 1])];
    for (let j = 1; j <= n; j++) {
      const x = a[i - 1], y = b[j - 1];
      const sub = x === y ? 0 : (VOW.has(x) && VOW.has(y)) || NEAR.has(x + y) ? 0.5 : 1;
      cur[j] = Math.min(prev[j - 1] + sub, prev[j] + cost(x), cur[j - 1] + cost(y));
    }
    prev = cur;
  }
  return prev[n];
}

/** Plain edit distance on characters. */
function lev(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = B.map((_, j) => j + 1);
  prev.unshift(0);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
    prev = cur;
  }
  return prev[B.length];
}

/** Weights, tuned on the Dakshina and Aksharantar test sets (Nov 2026). */
export const RANK_WEIGHTS = { skel: 2, lit: 0.6, freq: 0.2, maxSkel: 1.5, len: 0.6 };

// ---------------------------------------------------------------- ranker

interface Entry {
  w: string;
  s: string;
  /** commonness: higher is more used */
  f: number;
}

export interface ManglishRanker {
  /** How many words the list holds. */
  size: number;
  /** Known words that fit a Manglish word, best first, with their scores. */
  lookup(word: string, max?: number): { word: string; score: number }[];
  /** The offline suggestion list: known words first, then the letter readings (never dropped). */
  suggest(word: string, max?: number): string[];
  /**
   * Known words that sound like a Malayalam word (കര്യം → കാര്യം): spelling suggestions for a word
   * the dictionary doesn't know. Close words only; most used first among equals.
   */
  similar(word: string, max?: number): string[];
  /**
   * The writer's own words (Story World names, invented places…): suggested first when they fit
   * what was typed, ahead of common words. Replaces the previous set.
   */
  setOwnWords(words: string[]): void;
  /** Where a word stands in the list (0 = most used), or -1 when it isn't listed. */
  rankOf(word: string): number;
  /**
   * Spelling fixes for a word the engine calls a likely typo: its fixes and the known words that
   * sound like it, the common and close ones first (most fixes are one slip away from a common word).
   */
  rankFixes(word: string, fixes: string[], max?: number): string[];
  /**
   * For a word nobody knows (not listed, not in the dictionary, not the engine's): common words one
   * letter away, so it can be asked about as a likely typo (ണൽകാൻ → നൽകാൻ). Empty when nothing is
   * that close, so names and new words stay unmarked.
   */
  closeWords(word: string): string[];
}

/** How common a fix must be (its place in the list) to turn an unknown word into "Check spelling?". */
const CLOSE_TOP = 30000;

/** Malayalam words in a name or phrase ("ഹന്ന ജോസഫ്" → ഹന്ന, ജോസഫ്), for setOwnWords. */
export function ownWordsFrom(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts)
    for (const w of (t ?? "").replace(/[\u200c\u200d]/g, "").split(/[^\u0D00-\u0D7F]+/)) if ([...w].length >= 2) out.add(w);
  return [...out];
}

/** Commonness given to the writer's own words: above every listed word (the most used has 0). */
const OWN = 2;

/** One word per line, most used first (ZWJ/ZWNJ ignored; blank lines skipped). */
export function parseWordList(text: string): string[] {
  return text.split("\n").map((w) => w.trim()).filter(Boolean);
}

/** Add words to an index, a slice at a time (so phones can build it in idle moments). */
function addWords(idx: Map<string, Entry[]>, words: string[], start: number, end: number, ranks: Map<string, number>) {
  for (let i = start; i < end && i < words.length; i++) {
    const w = words[i];
    if (!ranks.has(w)) ranks.set(w, i);
    const s = scriptKey(w);
    if (!s) continue;
    const o = outline(s);
    let b = idx.get(o);
    if (!b) idx.set(o, (b = []));
    b.push({ w, s, f: -Math.log(i + 1) });
  }
}

function makeRanker(idx: Map<string, Entry[]>, size: () => number, ranks: Map<string, number>): ManglishRanker {
  const W = RANK_WEIGHTS;
  let own = new Map<string, Entry[]>();
  const buckets = (o: string) => [...(own.get(o) ?? []), ...(idx.get(o) ?? [])];
  function lookup(word: string, max = 8) {
    const keys = latinKeys(word);
    const literal = manglishWord(word);
    // a typed final u may be ് or ു (enthaanu → എന്താണ്): usage decides, as with Google
    const literalHalf = literal.replace(/ു$/, "്");
    const lens = latinLengths(word);
    const seen = new Map<string, number>();
    for (const o of new Set(keys.map(outline))) {
      for (const e of buckets(o)) {
        if (seen.has(e.w)) continue;
        const es = e.s.replace(/^y(?=[aeiou])/, ""); // യു… is typed u…
        let d = Infinity;
        for (const k of keys) d = Math.min(d, skelDist(k, e.s) + (VOW.has(k[0]) === VOW.has(es[0]) ? 0 : 1));
        if (d > W.maxSkel) continue;
        seen.set(e.w, -W.skel * d - W.lit * Math.min(lev(literal, e.w), lev(literalHalf, e.w)) + W.freq * e.f - W.len * lev(lens, scriptLengths(e.w)));
      }
    }
    return [...seen].map(([w, score]) => ({ word: w, score })).sort((a, b) => b.score - a.score).slice(0, max);
  }
  function suggest(word: string, max = 6) {
    const out: string[] = [];
    const add = (s: string) => {
      if (s && !out.includes(s)) out.push(s);
    };
    // Litma's own fixed spellings win
    if (Object.prototype.hasOwnProperty.call(COMMON, word)) add(COMMON[word]);
    // pieces of words (ngal, mpi, rr), digits and punctuation keep the letter readings
    if (!/^[A-Za-z]{3,}$/.test(word) || /^(ng|nk|mp|nt|nd|nch|nth|rr|thh)/.test(word)) {
      for (const c of manglishCandidates(word, max)) add(c);
      return out.slice(0, max);
    }
    // capitals, ~ or _ mean the writer is spelling exactly: their reading leads
    const exact = exactReading(word);
    if (exact) add(exact);
    for (const s of lookup(word, max)) add(s.word);
    for (const c of manglishCandidates(word, max)) add(c);
    // the plain reading always stays within the first six
    const lit = manglishWord(word);
    const keep = Math.min(max, 6);
    if (!out.slice(0, keep).includes(lit)) {
      const at = out.indexOf(lit);
      if (at >= 0) out.splice(at, 1);
      out.splice(keep - 1, 0, lit);
    }
    return out.slice(0, max);
  }
  function similar(word: string, max = 6) {
    const w = word.replace(/[\u200c\u200d]/g, "");
    const s = scriptKey(w);
    if (!s) return [];
    const found: { word: string; score: number }[] = [];
    for (const e of buckets(outline(s))) {
      if (e.w === w || found.some((x) => x.word === e.w)) continue;
      const d = skelDist(s, e.s);
      if (d > W.maxSkel) continue;
      const l = lev(w, e.w);
      if (l > 2) continue;
      found.push({ word: e.w, score: -W.skel * d - W.lit * l + W.freq * e.f });
    }
    return found.sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.word);
  }
  // tuned on 387 realistic slips of common words (ന/ണ, ല/ള, ര/റ, vowel length, a lost ് or double
  // letter): the right fix first 66.7% → 72.4% for the engine's own suspects, and 86 of 102 typos it
  // had nothing for are now asked about, while only 1.7% of real words it doesn't know are (Nov 2026)
  function rankFixes(word: string, fixes: string[], max = 4) {
    const cands = [...fixes];
    for (const s of similar(word, 3)) if (!cands.includes(s)) cands.push(s);
    return cands
      .map((c) => {
        const r = ranks.get(c);
        const k = fixes.indexOf(c);
        return { c, score: 0.2 * (r !== undefined ? -Math.log(r + 1) : -14) - lev(word, c) - 0.3 * (k >= 0 ? k : 2) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((x) => x.c);
  }
  function closeWords(word: string) {
    const w = word.replace(/[\u200c\u200d]/g, "");
    if (ranks.has(w) || [...w].length < 3) return [];
    return similar(w, 3).filter((c) => {
      const r = ranks.get(c);
      return r !== undefined && r < CLOSE_TOP && lev(w, c) <= 1;
    });
  }
  return {
    get size() {
      return size();
    },
    rankFixes,
    closeWords,
    lookup,
    suggest,
    similar,
    rankOf: (word: string) => ranks.get(word) ?? -1,
    setOwnWords(words: string[]) {
      const next = new Map<string, Entry[]>();
      for (const w of words) {
        const s = scriptKey(w);
        if (!s) continue;
        const o = outline(s);
        let b = next.get(o);
        if (!b) next.set(o, (b = []));
        if (!b.some((e) => e.w === w)) b.push({ w, s, f: OWN });
      }
      own = next;
    },
  };
}

/** Build a ranker from a word list (most used first) in one go. */
export function createManglishRanker(words: string[]): ManglishRanker {
  const idx = new Map<string, Entry[]>();
  const ranks = new Map<string, number>();
  addWords(idx, words, 0, words.length, ranks);
  return makeRanker(idx, () => words.length, ranks);
}

/**
 * Build a ranker a slice at a time, yielding between slices (`pause` is e.g. a
 * requestIdleCallback/setTimeout promise), so typing never waits on it.
 */
export async function buildManglishRanker(words: string[], pause: () => Promise<void>, slice = 5000): Promise<ManglishRanker> {
  const idx = new Map<string, Entry[]>();
  const ranks = new Map<string, number>();
  for (let i = 0; i < words.length; i += slice) {
    addWords(idx, words, i, i + slice, ranks);
    await pause();
  }
  return makeRanker(idx, () => words.length, ranks);
}
