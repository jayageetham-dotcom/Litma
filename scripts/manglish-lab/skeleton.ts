// Loose "sound skeleton" shared by Malayalam script and Manglish, so that every way of
// typing a word lands on the same key. Ambiguities writers don't mark (ന/ണ, ല/ള, ര/റ,
// ത/ട/ദ, long/short vowels, doubled letters, final ് vs u) collapse into one class.

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
const CHILLU: Record<string, string> = { "ൻ": "n", "ൺ": "n", "ൽ": "l", "ൾ": "l", "ർ": "r", "ൿ": "k", "ൔ": "m", "ൕ": "y", "ൖ": "z", "ം": "m", "ഃ": "h" };
const VIRAMA = "്";

function squeeze(s: string): string {
  return s
    .replace(/(.)\1+/g, "$1") // doubled letters
    .replace(/[nm](?=[^aeiouyJ])/g, "n") // ം / n / m before a consonant
    .replace(/(?<=[ie])y(?=[aeiou])/g, "") // glide: koriyan = korean
    .replace(/(?<=[^aeiou])u$/, ""); // final u or half-u
}

/** Consonant outline used as the index key (vowels are scored, not matched). */
export function outline(skel: string): string {
  return skel.replace(/[aeiouy]/g, "").replace(/g/g, "k").replace(/b/g, "p").replace(/z/g, "r");
}

/** Skeleton of a word in Malayalam script. */
export function scriptKey(w: string): string {
  const chars = [...w.replace(/[‌‍]/g, "")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      let k = CONS[c];
      const prev = chars[i - 1], prev2 = chars[i - 2];
      // ന്റ and റ്റ are typed nt / tt
      if (c === "റ" && prev === VIRAMA && (prev2 === "ന" || prev2 === "റ")) k = "t";
      if (c === "റ" && chars[i + 1] === VIRAMA && chars[i + 2] === "റ") k = "t";
      // ങ്ങ is typed ng, ങ്ക nk
      if (c === "ങ" && chars[i + 1] === VIRAMA && chars[i + 2] === "ങ") { out += "ng"; i += 2; continue; }
      // ജ്ഞ is typed jn / gn
      if (c === "ഞ" && prev === VIRAMA && prev2 === "ജ") k = "n";
      // ഞ്ച is typed nch
      if (c === "ഞ" && chars[i + 1] === VIRAMA && chars[i + 2] === "ച") k = "n";
      out += k;
      const nx = chars[i + 1];
      if (nx === VIRAMA) { i++; continue; }
      if (nx && SIGN[nx]) { out += SIGN[nx]; i++; continue; }
      out += "a";
      continue;
    }
    if (IND[c]) { out += IND[c]; continue; }
    if (CHILLU[c]) { out += CHILLU[c]; continue; }
    if (SIGN[c]) { out += SIGN[c]; continue; }
  }
  return squeeze(out);
}

// Manglish → skeleton. Longest match first; a few spellings branch (ee: ഈ or ഏ, oo: ഊ or ഓ).
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
  ["p", ["p"]], ["b", ["b"]], ["m", ["m"]], ["y", ["y"]], ["r", ["r"]], ["l", ["l"]],
  ["v", ["v"]], ["s", ["s"]], ["h", ["h"]],
];

/** Skeletons a Manglish word may stand for (a handful at most). */
export function latinKeys(word: string, limit = 16): string[] {
  const w = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/c[ck](?!h)/g, "k")
    .replace(/c(?=[eiy])/g, "s") // English: officer, license, cylinder
    .replace(/tion/g, "shan")
    .replace(/(?<=[^aeiou][^aeiou]?)e$/, "") // silent final e: license, union(e)
    .replace(/y(?![aeiou])/g, "i");
  let acc = [""];
  let i = 0;
  while (i < w.length) {
    const hit = LAT.find(([k]) => w.startsWith(k, i));
    if (!hit) { i++; continue; }
    // a stray h after a consonant (krishhna, sthh) adds nothing
    if (hit[0] === "h" && i > 0 && !/[aeiou]/.test(w[i - 1])) { i++; continue; }
    const next: string[] = [];
    for (const a of acc) for (const v of hit[1]) next.push(a + v);
    acc = next.slice(0, limit);
    i += hit[0].length;
  }
  return [...new Set(acc.map(squeeze))];
}

const LONG_SIGN = new Set(["ാ", "ീ", "ൂ", "േ", "ോ", "ആ", "ഈ", "ഊ", "ഏ", "ഓ", "ൈ", "ൗ", "ഐ", "ഔ"]);
const SHORT_SIGN = new Set(["ി", "ു", "െ", "ൊ", "ൃ", "അ", "ഇ", "ഉ", "എ", "ഒ"]);
/** Vowel lengths in script, e.g. താരാ → "SL" (short a, long aa), final ് ignored. */
export function scriptLengths(w: string): string {
  const ch = [...w];
  let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (LONG_SIGN.has(c)) out += "L";
    else if (SHORT_SIGN.has(c)) out += "S";
    else if (CONS[c]) {
      const nx = ch[i + 1];
      if (!nx || (!LONG_SIGN.has(nx) && !SHORT_SIGN.has(nx) && nx !== VIRAMA && !(nx in SIGN))) out += "S"; // inherent a
    }
  }
  return out.replace(/S$/, ""); // a final short vowel is often dropped or added
}
/** Vowel lengths the writer typed (aa, ee, oo… are long). */
export function latinLengths(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const out = [...w.matchAll(/[aeiou]+/g)].map((m) => (m[0].length > 1 && !/^(ai|au|ou|ei|ia|io|iu|ua|ue|ui|eo|ea|oe)$/.test(m[0]) ? "L" : "S")).join("");
  return out.replace(/S$/, "");
}
/** Doubled consonants: typed (kk, nn, cch…) and written (ക്ക, ന്ന…). */
export function latinDoubles(word: string): number {
  return (word.toLowerCase().match(/([bcdfgjklmnprstvwyz])\1|cch|tth|chch|thth/g) || []).length;
}
export function scriptDoubles(w: string): number {
  return (w.match(/([\u0D15-\u0D39])\u0D4D\1/g) || []).length;
}
