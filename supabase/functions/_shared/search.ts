/**
 * Search that understands Manglish: "puthiya" finds പുതിയ, "nammude" finds നമ്മുടെ, even
 * part-way through a word ("puth" → പുതിയ). It forgives too: a Malayalam spelling that sounds the
 * same (കത → കഥ) or a typo ("malayalm") still finds it, ranked after exact matches. Both sides are turned into a rough sound key
 * (Malayalam is romanised first) and compared, so the many ways people spell Malayalam in
 * English letters still match. Plain substring matching always works as well.
 *
 * Dependency-free; the phone app has the same rules in lib/core/search.dart (keep in step).
 */

const VOWELS: Record<string, string> = {
  "അ": "a", "ആ": "aa", "ഇ": "i", "ഈ": "ee", "ഉ": "u", "ഊ": "oo", "ഋ": "ru", "എ": "e", "ഏ": "e", "ഐ": "ai", "ഒ": "o", "ഓ": "o", "ഔ": "au",
};
const SIGNS: Record<string, string> = {
  "ാ": "aa", "ി": "i", "ീ": "ee", "ു": "u", "ൂ": "oo", "ൃ": "ru", "െ": "e", "േ": "e", "ൈ": "ai", "ൊ": "o", "ോ": "o", "ൌ": "au", "ൗ": "au",
};
const CONSONANTS: Record<string, string> = {
  "ക": "k", "ഖ": "kh", "ഗ": "g", "ഘ": "gh", "ങ": "ng", "ച": "ch", "ഛ": "chh", "ജ": "j", "ഝ": "jh", "ഞ": "nj",
  "ട": "t", "ഠ": "th", "ഡ": "d", "ഢ": "dh", "ണ": "n", "ത": "th", "ഥ": "th", "ദ": "d", "ധ": "dh", "ന": "n",
  "പ": "p", "ഫ": "ph", "ബ": "b", "ഭ": "bh", "മ": "m", "യ": "y", "ര": "r", "റ": "r", "ല": "l", "ള": "l",
  "ഴ": "zh", "വ": "v", "ശ": "sh", "ഷ": "sh", "സ": "s", "ഹ": "h",
};
const OTHER: Record<string, string> = { "ം": "m", "ഃ": "h", "ൻ": "n", "ർ": "r", "ൽ": "l", "ൾ": "l", "ൺ": "n", "ൿ": "k" };
/** Clusters people spell differently from their letters: എന്റെ is "ente", കുട്ടി is "kutti". */
const CLUSTERS: [string, string][] = [
  ["ന്റ", "nt"], ["റ്റ", "tt"], ["ഞ്ഞ", "nj"], ["ങ്ങ", "ng"], ["ന്ത", "nth"], ["ക്ഷ", "ksh"],
];
const VIRAMA = "്";
const ML = /[ഀ-ൿ]/;

/** Malayalam script → English letters, the way it is usually typed ("പുതിയ" → "puthiya"). Other text passes through. */
export function romanise(text: string): string {
  let s = text.replace(/[‌‍]/g, "");
  for (const [k, v] of CLUSTERS) s = s.split(k).join(`\u0001${v}\u0002`);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\u0001") {
      // a whole cluster: take it as a consonant (it gets a vowel like one)
      const end = s.indexOf("\u0002", i);
      out += s.slice(i + 1, end);
      i = end;
      out += vowelAfter(s, i);
      if (s[i + 1] === VIRAMA || SIGNS[s[i + 1]]) i++;
      continue;
    }
    if (CONSONANTS[ch]) {
      out += CONSONANTS[ch] + vowelAfter(s, i);
      if (s[i + 1] === VIRAMA || SIGNS[s[i + 1]]) i++;
      continue;
    }
    out += VOWELS[ch] ?? OTHER[ch] ?? (ch === VIRAMA ? "" : ch);
  }
  return out;
}

/** The vowel a consonant at i carries: its sign, none after a virama, otherwise the inherent "a". */
function vowelAfter(s: string, i: number): string {
  const next = s[i + 1];
  if (next === VIRAMA) return "";
  return SIGNS[next] ?? "a";
}

/**
 * A rough sound key: aspirates and long vowels fold together, doubled letters become single,
 * t/d and the like merge (Manglish typists use them freely).
 */
export function soundKey(text: string): string {
  return romanise(text.toLowerCase())
    .replace(/chh|ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/zh/g, "z")
    .replace(/([kgjtdpb])h/g, "$1")
    .replace(/th/g, "t")
    .replace(/f/g, "p")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/d/g, "t")
    .replace(/aa/g, "a")
    .replace(/ee|ii/g, "i")
    .replace(/oo|uu/g, "u")
    .replace(/(.)\1+/g, "$1")
    .replace(/[^a-z0-9ഀ-ൿ]+/g, " ")
    .trim();
}

const LATIN = /[a-z]/i;
const ML_WORD = /[ഀ-ൿ‌‍]+/g;

/**
 * Typos a word may have and still match, by the length of its sound key: none for short words
 * (too many false hits), one from 5 letters ("malayalm"), two only from 12.
 */
const slips = (n: number) => (n < 5 ? 0 : n < 12 ? 1 : 2);

/** Edit distance of a and b (a swap of two neighbouring letters counts as one), or max + 1 when above max. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    before = prev;
    prev = cur;
  }
  return Math.min(prev[b.length], max + 1);
}

/**
 * How many typos away the start of word key `wk` is from `k` (so part of a word still matches),
 * or -1 when it is too far for a key that long.
 */
function nearStart(wk: string, k: string): number {
  const s = slips(k.length);
  if (!s) return -1;
  let best = s + 1;
  for (let len = Math.max(1, k.length - s); len <= Math.min(wk.length, k.length + s); len++) best = Math.min(best, distance(wk.slice(0, len), k, s));
  return best <= s ? best : -1;
}

/** Sound keys of the words of a text: Malayalam by sound, other words as typed. */
function wordKeys(text: string): string[] {
  const ml = (text.match(ML_WORD) ?? []).map(soundKey);
  const other = text.replace(ML_WORD, " ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(soundKey);
  return [...ml, ...other];
}

/**
 * How well `text` matches the search `query`: 3 as typed, 2 by sound (Manglish for Malayalam, or a
 * Malayalam spelling that sounds the same: കത finds കഥ, മലയാലം finds മലയാളം), 1 with a typo
 * ("malayalm", "puthya"), 0 not at all. Every word of the query must match; the weakest counts.
 * Lists show better matches first.
 */
export function searchRank(text: string | null | undefined, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 3;
  if (!text) return 0;
  const plain = text.toLowerCase();
  if (plain.includes(q)) return 3;
  let keys: string[] | null = null;
  let joined = "";
  let rank = 3;
  for (const w of q.split(/\s+/)) {
    if (plain.includes(w)) continue;
    if (!keys) {
      keys = wordKeys(text);
      joined = keys.join(" ");
    }
    const k = soundKey(w).replace(/\s+/g, "");
    if (!k) return 0;
    if (joined.includes(k)) rank = Math.min(rank, 2);
    else if (keys.some((wk) => nearStart(wk, k) >= 0)) rank = 1;
    else return 0;
  }
  return rank;
}

/**
 * Does `text` match the search `query`? Every word of the query must be found: as typed, by sound
 * (Manglish or Malayalam), or with a typo. See searchRank for the order to show them in.
 */
export function matchesSearch(text: string | null | undefined, query: string): boolean {
  return searchRank(text, query) > 0;
}

/**
 * Malayalam words in `text` that sound like `query` (best first: the word that starts with it,
 * then the shortest, then near misses). For find-in-work, where the match has to be real text.
 * In English letters it is the Manglish ("kada" → കടൽ); in Malayalam, other spellings of the same
 * sound (കത → കഥ), never the query itself.
 */
export function manglishMatches(text: string, query: string, max = 4): string[] {
  const q = query.trim();
  if (!q || /\s/.test(q)) return [];
  const k = soundKey(q);
  if (!k) return [];
  const seen = new Map<string, number>();
  for (const w of text.match(ML_WORD) ?? []) {
    if (seen.has(w) || w === q) continue;
    const wk = soundKey(w);
    const at = wk.indexOf(k);
    if (at >= 0) seen.set(w, at === 0 ? wk.length : 1000 + wk.length);
    else {
      const d = nearStart(wk, k);
      if (d >= 0) seen.set(w, 2000 + d * 100 + Math.abs(wk.length - k.length));
    }
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([w]) => w);
}
