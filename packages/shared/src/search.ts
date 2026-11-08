/**
 * Search that understands Manglish: "puthiya" finds പുതിയ, "nammude" finds നമ്മുടെ, even
 * part-way through a word ("puth" → പുതിയ). Both sides are turned into a rough sound key
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

/**
 * Does `text` match the search `query`? Every word of the query must be found, either as typed
 * or, when it is in English letters, by sound in the Malayalam of the text.
 */
export function matchesSearch(text: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (!text) return false;
  const plain = text.toLowerCase();
  if (plain.includes(q)) return true;
  if (!LATIN.test(q) || !ML.test(text)) return false;
  const key = mlKey(text);
  return q.split(/\s+/).every((w) => plain.includes(w) || (LATIN.test(w) && soundKey(w).length > 0 && key.includes(soundKey(w))));
}

/** The sound key of only the Malayalam words of a text (English words are matched as typed). */
function mlKey(text: string): string {
  return (text.match(/[ഀ-ൿ‌‍]+/g) ?? []).map(soundKey).join(" ");
}

/**
 * Malayalam words in `text` that sound like the English-letters `query` (best first: the word
 * that starts with it, then the shortest). For find-in-work, where the match has to be real text.
 */
export function manglishMatches(text: string, query: string, max = 4): string[] {
  const q = query.trim();
  if (!q || !LATIN.test(q) || /\s/.test(q)) return [];
  const k = soundKey(q);
  if (!k) return [];
  const seen = new Map<string, number>();
  for (const w of text.match(/[ഀ-ൿ‌‍]+/g) ?? []) {
    if (seen.has(w)) continue;
    const wk = soundKey(w);
    const at = wk.indexOf(k);
    if (at >= 0) seen.set(w, at === 0 ? wk.length : 1000 + wk.length);
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([w]) => w);
}
