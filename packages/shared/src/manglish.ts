/**
 * Litma Manglish engine — an offline, Mozhi-inspired transliterator.
 *
 * It converts a romanised Malayalam word ("ente", "kadha", "nammude") into
 * Malayalam script instantly, with no network. Google Input Tools results are
 * merged on top of this (see the litma-transliterate Edge Function) for smarter predictions.
 *
 * Case matters, Mozhi-style:  t=ട  T=ട  th=ത  d=ദ  D=ഡ  n=ന  N=ണ  l=ല  L=ള
 * r=ര  R=റ  s=സ  S=ശ  sh=ഷ  zh=ഴ  aa/A=ആ  ee/ii/I=ഈ  oo/uu/U=ഊ  E=ഏ  O=ഓ
 * Use "~" to force a chandrakkala (്) and "_" to break a cluster.
 */

const VOWELS: Record<string, [string, string]> = {
  // key: [independent vowel, vowel sign]
  aa: ["ആ", "ാ"],
  A: ["ആ", "ാ"],
  a: ["അ", ""],
  ii: ["ഈ", "ീ"],
  ee: ["ഈ", "ീ"],
  I: ["ഈ", "ീ"],
  i: ["ഇ", "ി"],
  uu: ["ഊ", "ൂ"],
  oo: ["ഊ", "ൂ"],
  U: ["ഊ", "ൂ"],
  u: ["ഉ", "ു"],
  ai: ["ഐ", "ൈ"],
  ei: ["ഐ", "ൈ"],
  au: ["ഔ", "ൗ"],
  ou: ["ഔ", "ൗ"],
  ae: ["ഏ", "േ"],
  E: ["ഏ", "േ"],
  e: ["എ", "െ"],
  oa: ["ഓ", "ോ"],
  O: ["ഓ", "ോ"],
  o: ["ഒ", "ൊ"],
  "R^": ["ഋ", "ൃ"],
  rh: ["ഋ", "ൃ"],
};

const CONSONANTS: Record<string, string> = {
  // conjunct shortcuts first (longest match wins anyway)
  ksh: "ക്ഷ",
  x: "ക്സ",
  nch: "ഞ്ച",
  nth: "ന്ത",
  nt: "ന്റ",
  nd: "ണ്ട",
  nk: "ങ്ക",
  ng: "ങ്ങ",
  nj: "ഞ",
  mp: "മ്പ",
  tth: "ത്ത",
  thth: "ത്ത",
  tt: "ട്ട",
  TT: "ട്ട",
  rr: "റ",
  // plain consonants
  kh: "ഖ",
  k: "ക",
  q: "ക",
  c: "ച",
  gh: "ഘ",
  g: "ഗ",
  chh: "ഛ",
  Ch: "ഛ",
  ch: "ച",
  jh: "ഝ",
  j: "ജ",
  z: "ശ",
  Th: "ഠ",
  T: "ട",
  t: "ട",
  Dh: "ഢ",
  D: "ഡ",
  N: "ണ",
  thh: "ഥ",
  th: "ത",
  dh: "ധ",
  d: "ദ",
  n: "ന",
  ph: "ഫ",
  f: "ഫ",
  p: "പ",
  bh: "ഭ",
  b: "ബ",
  m: "മ",
  y: "യ",
  r: "ര",
  R: "റ",
  L: "ള",
  l: "ല",
  w: "വ",
  v: "വ",
  zh: "ഴ",
  sh: "ഷ",
  S: "ശ",
  s: "സ",
  h: "ഹ",
};

/** Final consonants that become chillu letters at the end of a word. */
const CHILLU: Record<string, string> = {
  n: "ൻ",
  N: "ൺ",
  l: "ൽ",
  L: "ൾ",
  r: "ർ",
  R: "ർ",
  m: "ം",
};

const VIRAMA = "്";
const SPECIAL: Record<string, string> = { M: "ം", H: "ഃ", "~": VIRAMA };

const vowelKeys = Object.keys(VOWELS).sort((a, b) => b.length - a.length);
const consKeys = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);

function match(word: string, i: number, keys: string[]): string | null {
  for (const k of keys) if (word.startsWith(k, i)) return k;
  return null;
}

/** Transliterate a single romanised word. Non-latin characters pass through. */
export function manglishWord(word: string): string {
  let out = "";
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    if (ch === "_") {
      i++;
      continue;
    }
    if (SPECIAL[ch]) {
      out += SPECIAL[ch];
      i++;
      continue;
    }
    const ck = match(word, i, consKeys);
    if (ck) {
      const base = CONSONANTS[ck];
      i += ck.length;
      if (word[i] === "~") {
        out += base + VIRAMA;
        i++;
        continue;
      }
      const vk = match(word, i, vowelKeys);
      if (vk) {
        out += base + VOWELS[vk][1];
        i += vk.length;
        continue;
      }
      const atEnd = i >= word.length || !/[A-Za-z]/.test(word[i]);
      if (atEnd) {
        // single-letter keys can become chillu (avan → അവൻ, maram → മരം)
        if (ck.length === 1 && CHILLU[ck] && out.length > 0) out += CHILLU[ck];
        else if (ck === "rr") out += CHILLU.R;
        else out += base + VIRAMA;
      } else if (word[i] === "M" || word[i] === "H") {
        out += base;
      } else if (ck === "r" && out.length > 0 && !/^[yr]/.test(word.slice(i))) {
        // modern spelling: ർ before a consonant (ചേർത്ത്, കാർത്തിക)
        out += CHILLU.r;
      } else {
        out += base + VIRAMA;
      }
      continue;
    }
    const vk = match(word, i, vowelKeys);
    if (vk) {
      out += VOWELS[vk][0];
      i += vk.length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Transliterate a whole phrase, word by word (punctuation and spaces preserved). */
export function manglish(text: string): string {
  return text.replace(/[A-Za-z~_^]+/g, (w) => manglishWord(w));
}

/** Characters that may appear inside a Manglish word while composing. */
export const MANGLISH_WORD_RE = /[A-Za-z~_^]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// Malayalam text metrics: aksharas, laghu/guru (metre) and word counts.

const ML_CONS = /[ക-ഹഺ]/;
const ML_IND_VOWEL = /[അ-ഔൠൡ]/;
const LONG_SIGNS = /[ാീൂൄേൈോൌൗ]/;
const LONG_VOWELS = /[ആഈഊഏഐഓഔൡ]/;
const CHILLUS = /[ൺ-ൿൎ]/;

export interface Akshara {
  text: string;
  long: boolean;
}

/** Split a Malayalam line into aksharas (syllables). Chillus and ം/ഃ attach to the previous akshara. */
export function aksharas(line: string): Akshara[] {
  const res: Akshara[] = [];
  let cur = "";
  let prevVirama = false;
  for (const ch of line) {
    const isCons = ML_CONS.test(ch);
    const isVowel = ML_IND_VOWEL.test(ch);
    if ((isCons && !prevVirama) || isVowel) {
      if (cur) res.push({ text: cur, long: false });
      cur = ch;
    } else if (/[ഀ-ൿ‌‍]/.test(ch)) {
      cur += ch;
    } else {
      if (cur) res.push({ text: cur, long: false });
      cur = "";
    }
    prevVirama = ch === VIRAMA;
  }
  if (cur) res.push({ text: cur, long: false });
  // A trailing virama-only consonant (samvruthokaram/half letter) is not a separate akshara: merge
  const merged: Akshara[] = [];
  for (const a of res) {
    if (!ML_IND_VOWEL.test(a.text[0]) && !ML_CONS.test(a.text[0])) continue;
    merged.push(a);
  }
  // laghu / guru
  for (let k = 0; k < merged.length; k++) {
    const t = merged[k].text;
    let long = LONG_SIGNS.test(t) || LONG_VOWELS.test(t[0]) || /[ംഃ]/.test(t) || CHILLUS.test(t);
    const next = merged[k + 1]?.text;
    // short syllable followed by a conjunct (C്C…) is guru
    if (!long && next && next.length > 2 && next[1] === VIRAMA && ML_CONS.test(next[2] ?? "")) long = true;
    // syllable whose own text ends in virama before a consonant (e.g. "ക്" closing) is guru
    if (!long && t.endsWith(VIRAMA)) long = true;
    merged[k].long = long;
  }
  return merged;
}

/** Pattern like "– ∪ – –" using – for guru and ∪ for laghu. */
export function metrePattern(line: string): string {
  return aksharas(line)
    .map((a) => (a.long ? "–" : "∪"))
    .join("");
}

export function countWords(text: string): number {
  const m = text.trim().match(/[^\s​]+/g);
  return m ? m.length : 0;
}

/** Reading time in minutes — Malayalam prose reads slower than English; ~150 wpm. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 150));
}
