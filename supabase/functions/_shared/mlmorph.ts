/**
 * Malayalam spelling engine built on Swathanthra Malayalam Computing's mlmorph (MIT licence,
 * https://gitlab.com/smc/mlmorph, Santhosh Thottingal and contributors): a finite-state morphology
 * that knows how Malayalam words are built (roots, case endings, tense, sandhi, compounds), so it
 * accepts the endless inflected forms a word list never could.
 *
 * - MlMorph reads the transducer laid out by scripts/build-mlmorph.mjs ("LMF1") and looks words up:
 *   accepts(word) (is there any analysis?) and analyse(word) (root and tags, best first).
 * - MlSpeller adds mlmorph's spellchecker on top: its list of common misspellings, its foreign-word
 *   detector (English words written in Malayalam are not mistakes), and its twelve strategies for
 *   suggestions (chillu forms, ന്റ, മ്പ, doubled consonants, vowel length, look-alike and
 *   sound-alike letters), each candidate kept only if the morphology accepts it.
 *
 * Dependency-free: runs in the litma-spell Edge Function (Deno) and could run in a browser worker.
 * mlmorph's copyright and MIT licence notice: THIRD_PARTY_NOTICES.md at the repository root.
 */

// ── the transducer ──

export class MlMorph {
  private final: Uint8Array;
  private first: Uint32Array;
  private target: Uint32Array;
  private lower: Uint16Array;
  private upper: Uint16Array;
  private codes = new Map<string, number>();
  private names: string[] = [];

  constructor(data: ArrayBuffer | Uint8Array) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    // copy into a fresh, aligned buffer so typed-array views can sit on it
    const buf = u8.byteOffset % 4 === 0 ? u8 : u8.slice();
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    if (magic !== "LMF1") throw new Error("Not an LMF1 transducer");
    const nodes = view.getUint32(4, true);
    const arcs = view.getUint32(8, true);
    const symLen = view.getUint32(12, true);
    const symbols = JSON.parse(new TextDecoder().decode(buf.subarray(16, 16 + symLen))) as Record<string, string>;
    for (const [code, s] of Object.entries(symbols)) {
      this.names[Number(code)] = s;
      if (Number(code) !== 0) this.codes.set(s, Number(code));
    }
    const pad = (n: number) => n + ((4 - (n % 4)) % 4);
    let p = pad(16 + symLen);
    const at = buf.byteOffset;
    this.final = new Uint8Array(buf.buffer, at + p, nodes);
    p = pad(p + nodes);
    this.first = new Uint32Array(buf.buffer, at + p, nodes + 1);
    p += (nodes + 1) * 4;
    this.target = new Uint32Array(buf.buffer, at + p, arcs);
    p += arcs * 4;
    this.lower = new Uint16Array(buf.buffer, at + p, arcs);
    p += arcs * 2;
    this.upper = new Uint16Array(buf.buffer, at + p, arcs);
  }

  /** The word as symbol codes, or null when it has a character the transducer doesn't know. */
  private encode(word: string): number[] | null {
    const out: number[] = [];
    for (const ch of word) {
      const c = this.codes.get(ch);
      if (c === undefined) return null;
      out.push(c);
    }
    return out;
  }

  /** Arcs of node leaving with lower symbol c: [from, to). Arcs are sorted by lower symbol. */
  private range(node: number, c: number): [number, number] {
    let lo = this.first[node];
    let hi = this.first[node + 1];
    const end = hi;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.lower[mid] < c) lo = mid + 1;
      else hi = mid;
    }
    let to = lo;
    while (to < end && this.lower[to] === c) to++;
    return [lo, to];
  }

  /** Does the morphology accept this (normalised) word? Stops at the first analysis. */
  accepts(word: string): boolean {
    const input = this.encode(word);
    if (!input) return false;
    const n = input.length;
    const seen = new Set<number>();
    const stack: number[] = [0, 0];
    while (stack.length) {
      const pos = stack.pop()!;
      const node = stack.pop()!;
      const key = node * 64 + pos;
      if (seen.has(key)) continue;
      seen.add(key);
      if (pos === n && this.final[node]) return true;
      // epsilon on the surface side: move without reading a letter
      const [e0, e1] = this.range(node, 0);
      for (let a = e0; a < e1; a++) stack.push(this.target[a], pos);
      if (pos < n) {
        const [a0, a1] = this.range(node, input[pos]);
        for (let a = a0; a < a1; a++) stack.push(this.target[a], pos + 1);
      }
    }
    return false;
  }

  /** Analyses of the word ("root<tag>…"), at most max of them; [] when unknown. */
  analyse(word: string, max = 8): string[] {
    const input = this.encode(word);
    if (!input || input.length > 60) return [];
    const n = input.length;
    const out = new Set<string>();
    let budget = 200000; // a hard stop for pathological inputs
    const walk = (node: number, pos: number, acc: string, depth: number) => {
      if (out.size >= max || --budget < 0 || depth > 200) return;
      if (pos === n && this.final[node]) out.add(acc);
      const [e0, e1] = this.range(node, 0);
      for (let a = e0; a < e1; a++) walk(this.target[a], pos, acc + (this.upper[a] ? this.names[this.upper[a]] : ""), depth + 1);
      if (pos < n) {
        const [a0, a1] = this.range(node, input[pos]);
        for (let a = a0; a < a1; a++) walk(this.target[a], pos + 1, acc + (this.upper[a] ? this.names[this.upper[a]] : ""), depth + 1);
      }
    };
    walk(0, 0, "", 0);
    return [...out];
  }
}

// ── mlmorph's analysis weights (lower is simpler, so more likely) ──

const POS_WEIGHT: Record<string, number> = { v: 1, n: 2, adv: 3, adj: 4, coordinative: 4, "v-n-compound": 4, prn: 5, past: 4, "cvb-adv-part-past": 5, np: 5, fw: 1 };

export function analysisWeight(analysis: string): number {
  const morphemes = [...(analysis.startsWith("<") ? " " + analysis : analysis).matchAll(/([^<]+)((?:<[^>]+>)+)/g)];
  let w = morphemes.length * 100;
  for (const m of morphemes) {
    const tags = [...m[2].matchAll(/<([^>]+)>/g)].map((t) => t[1]);
    for (const t of tags) w += tags.length * 5 + m[1].length * 2 + (POS_WEIGHT[t] ?? t.length) * 3;
  }
  return w;
}

// ── mlmorph's normaliser and foreign-word detector ──

const NORMALISE: [string, string][] = [
  ["ണ്‍", "ൺ"],
  ["ന്‍", "ൻ"],
  ["ര്‍", "ർ"],
  ["ല്‍", "ൽ"],
  ["ള്‍", "ൾ"],
  ["ക്‍", "ൿ"],
  ["ൻ്റ", "ന്റ"],
  ["ൌ", "ൗ"],
];
export function normaliseWord(word: string): string {
  for (const [a, b] of NORMALISE) word = word.split(a).join(b);
  return word;
}

/** English (and other) words written in Malayalam script: accepted, never called mistakes. */
const FOREIGN = new RegExp(["\\\\S+[അ-ഔ]\\\\S+", "\\\\S+റ്റ്\\\\S+", "^ജെ", "^ട", "^ഡ", "^ഫാ", "^ഫി", "^ഫീ", "^ഫു", "^ഫെ", "^ഫെ", "^ഫൈ", "^ഫൊ", "^ഫോ", "^ബാൻ", "^ബാറ്റ്", "^ബെ", "^മെറ്റ", "മ്യൂ", "^ഷോ", "^സ്ക്രീ", "^ഹാ", "^ഹി", "^ഹെ", "^ഹൊ", "^ഹോ", "^ഹൗ", "^ഹ്യ", "^ഹ്വ", "^ള", "^ഴ", "^റ", "^റോ", "^റ്റൈ", "ഓൺ", "ക്ച", "ക്ട്$", "ക്യൂ", "ക്സ", "ക്ലോ", "ക്റ്റ്", "ഗ്രഫ", "ഗ്രഫി", "ഗിൾ", "ങ്സ്", "ച്വ", "ജ്യു", "ജ്യൂ", "ട്ര", "ഡിയോ", "ഡ്$", "ഡ്ക", "ഡ്മ", "ഡ്വ", "ഡ്സ", "ണിയൻ$", "ണിയർ$", "ണ്ടർ$", "ൻഡ", "ൻസ്", "ന്റം", "ന്റിക്", "ന്റ്$", "ന്റ്സ്", "ൻ്റ്$", "ന്റർ", "പ്രൊ", "പ്സ്$", "പ്റ്റ", "ഫ്ര", "ഫ്ല", "ഫ്ള", "ഫ്റ്റ", "ഫൈ", "ബിൻ", "ബിർ", "ബിൽ", "ബിൾ", "ബിറ്റ്", "ബെർ", "ബൈ", "ബ്രേ", "ബ്രോ", "ബ്ല", "ബ്സ", "ബ്ള", "മെമ്മ", "മൈസ", "മ്പ്യൂ", "യിറ്റ്", "യ്ൻ", "യ്സ", "യ്സ്", "യിസ", "യ്റ്റ്", "ർജ", "ർട", "ലിറ്റി", "ലീസ്", "ലൈസർ", "ൽസ്", "വെയർ$", "വൈസ്", "വേസ്", "ഷിസ്", "ഷ്യൻ$", "ഷ്യർ$", "ഷ്യൽ$", "ഷ്യസ്$", "സബ്", "സർ$", "സൽ$", "സെൽ", "സെർ", "സെൻ", "സിസ്", "സിറ്റി", "സെന്റ", "സ്കൂൾ", "സ്പേസ്", "സൈറ്റ", "സ്പ്ല", "സ്പ്ള", "സ്ബ", "സ്ല", "സ്ള", "സ്കാൻ", "സ്കോ", "സ്റ്റ", "^സ്വീ", "സ്ല", "സ്ട്ര", "ളജി", "ൾട്ട", "ഴ്സ", "റ്റിക്$", "റ്റിക്കലി$", "റ്റേൺ", "റ്ററ", "റ്റർ", "റ്റലൈ", "റൈറ്റ", "ിംഗ്$", "ിങ്$", "ിങ്ങ്$", "ിഷൻ", "ിസം$", "ിംസ്", "ീസ്$", "േഷൻ", "ൈറ്റ", "ോഷൻ", "ൗണ്ട", "്രീം", "ക്വേ", "[0-9]+"].join("|"), "u");
export function looksForeign(word: string): boolean {
  const w = word.trim().replace(/[​-‍]/g, "");
  if (w.length <= 1 || !/[ഀ-ൿ]/.test(w)) return true;
  return FOREIGN.test(w);
}

// ── suggestions: mlmorph's strategies, in its order ──

const CONSONANT = /[ക-ഹ]/;
const VIRAMA = "്";
const isC = (c: string | undefined) => !!c && CONSONANT.test(c);

function* replaceAll(word: string, pairs: [string, string][]) {
  for (const [a, b] of pairs) {
    const c = word.split(a).join(b);
    if (c !== word) yield c;
  }
}
function* perLetter(word: string, map: Record<string, string>, from = 1) {
  const ch = [...word];
  for (let i = from; i < ch.length; i++) {
    if (map[ch[i]] !== undefined) {
      const c = [...ch];
      c[i] = map[ch[i]];
      yield c.join("");
    }
  }
}

const STRATEGIES: ((w: string) => Iterable<string>)[] = [
  // atomic chillu
  (w) => replaceAll(w, [["ന്‍", "ൻ"], ["ര്‍", "ർ"], ["ല്‍", "ൽ"], ["ണ്‍", "ൺ"], ["ള്‍", "ൾ"]]),
  // വക്കുക → വയ്ക്കുക
  (w) => replaceAll(w, [["ക്കുക", "യ്ക്കുക"], ["ക്കൽ", "യ്ക്കൽ"]]),
  // ൻറ → ന്റ
  (w) => replaceAll(w, [["ൻറ", "ന്റ"], ["ൻ്റ", "ന്റ"]]),
  // ന്പ, ൻപ, ംപ → മ്പ
  (w) => replaceAll(w, [["ന്പ", "മ്പ"], ["ൻപ", "മ്പ"], ["ംപ", "മ്പ"], ["ംമ്പ", "മ്പ"]]),
  // look-alike letters
  (w) => replaceAll(w, [[":", "ഃ"], ["0", "ം"], ["O", "ഠ"], ["o", "ം"], [")", "ാ"], ["൯", "ൻ"], ["൪", "ർ"], ["ഝ", "ത്സ"], ["ത്സ", "ഝ"], ["ഞ്ജ", "ജ്ഞ"], ["ജ്ഞ", "ഞ്ജ"], ["ഭ", "ദ"], ["ദ", "ഭ"], ["ബ", "മ്പ"], ["മ്പ", "ബ"], ["ൃ", "്യ"], ["്യ", "ൃ"], ["്രു", "ൃ"]]),
  // sound-alike letters
  function* (w) {
    const ch = [...w];
    for (const group of ["കഖഗഘ", "ചഛജഝ", "ടഠഡഢ", "തഥദധ", "പഫബഭ", "രറ", "ലള", "ശഷസ"]) {
      for (let i = 0; i < ch.length; i++) {
        if (!group.includes(ch[i])) continue;
        for (const r of group) {
          if (r === ch[i]) continue;
          const c = [...ch];
          c[i] = r;
          yield c.join("");
        }
      }
    }
    yield* replaceAll(w, [["ദ്ധ", "ധ"], ["ധ", "ദ്ധ"], ["ശ്ച", "ച്ഛ"], ["ച്ഛ", "ശ്ച"], ["ഷ", "ക്ഷ"], ["ക്ഷ", "ഷ"]]);
  },
  // doubled consonants: add or remove the doubling
  function* (w) {
    const ch = [...w];
    for (let i = 1; i < ch.length - 1; i++) {
      if (ch[i - 1] === VIRAMA || ch[i + 1] === VIRAMA || !isC(ch[i])) continue;
      const c = [...ch];
      c[i] = ch[i] + VIRAMA + ch[i];
      yield c.join("");
    }
    for (let i = 1; i < ch.length - 2; i++) {
      if (ch[i] === ch[i + 2] && isC(ch[i]) && ch[i + 1] === VIRAMA) {
        const c = [...ch];
        c[i + 1] = "";
        c[i + 2] = "";
        yield c.join("");
      }
    }
  },
  // a virama between two consonants
  function* (w) {
    const ch = [...w];
    for (let i = 1; i < ch.length - 1; i++) {
      if (ch[i - 1] === VIRAMA || ch[i + 1] === VIRAMA) continue;
      if (isC(ch[i]) && isC(ch[i + 1])) {
        const c = [...ch];
        c[i] = ch[i] + VIRAMA;
        yield c.join("");
      }
    }
  },
  // longer vowel
  function* (w) {
    yield* perLetter(w, { "ി": "ീ", "ു": "ൂ", "െ": "േ", "ൊ": "ോ" });
    const ch = [...w];
    for (let i = 1; i < ch.length - 1; i++) {
      if (isC(ch[i]) && isC(ch[i + 1])) {
        const c = [...ch];
        c[i] = ch[i] + "ാ";
        yield c.join("");
      }
    }
  },
  // shorter vowel
  (w) => perLetter(w, { "ാ": "", "ീ": "ി", "ൂ": "ു", "േ": "െ", "ോ": "ൊ" }),
  // chillu → consonant + virama
  (w) => perLetter(w, { "ർ": "ര്", "ൽ": "ല്", "ൻ": "ന്", "ൺ": "ണ്", "ൾ": "ള്", "ം": "മ്" }),
  // consonant + virama → chillu
  function* (w) {
    const map: Record<string, string> = { "ര്": "ർ", "റ്": "ർ", "ല്": "ൽ", "ന്": "ൻ", "ണ്": "ൺ", "ള്": "ൾ", "മ്": "ം" };
    const ch = [...w];
    for (let i = 2; i < ch.length - 1; i++) {
      const pair = ch[i] + ch[i + 1];
      if (map[pair]) {
        const c = [...ch];
        c[i] = map[pair];
        c[i + 1] = "";
        yield c.join("");
      }
    }
  },
];

// ── the speller ──

export type WordVerdict =
  /** the morphology knows it, or it reads as a foreign word */
  | { word: string; ok: true }
  /** listed as a common misspelling: the standard spelling */
  | { word: string; ok: false; kind: "mistake"; fix: string[] }
  /** unknown, and close to words the morphology knows: probably a typo */
  | { word: string; ok: false; kind: "suspect"; fix: string[] }
  /** unknown with nothing close: a question, never an error (names, dialect, new words) */
  | { word: string; ok: false; kind: "unknown"; fix: [] };

export class MlSpeller {
  private cache = new Map<string, WordVerdict>();
  constructor(private morph: MlMorph, private mistakes: Record<string, string>) {}

  check(raw: string): WordVerdict {
    const hit = this.cache.get(raw);
    if (hit) return hit;
    const v = this.verdict(raw);
    if (this.cache.size > 50000) this.cache.clear();
    this.cache.set(raw, v);
    return v;
  }

  private verdict(raw: string): WordVerdict {
    const word = normaliseWord(raw);
    if (this.mistakes[word]) return { word: raw, ok: false, kind: "mistake", fix: [this.mistakes[word]] };
    if (this.morph.accepts(word) || looksForeign(word) || this.quoted(word)) return { word: raw, ok: true };
    const fix = this.suggest(word);
    return fix.length ? { word: raw, ok: false, kind: "suspect", fix } : { word: raw, ok: false, kind: "unknown", fix: [] };
  }

  /**
   * A word the morphology knows with the quotative എന്ന് (or എന്നു, എന്ന, എന്നും, എന്നോ) joined on:
   * ഇല്ല + എന്ന് → ഇല്ലെന്ന്. mlmorph has each half but not every chain of them (കാണാനില്ലെന്ന്,
   * അറിയില്ലെന്ന്, വരില്ലെന്ന്, പറഞ്ഞില്ലെന്ന്), and these are among the most written words in prose.
   */
  private quoted(word: string): boolean {
    const m = /^(.+[\u0D15-\u0D39])െന്ന(്|ു|ും|ോ)?$/u.exec(word);
    return !!m && [...m[1]].length >= 2 && this.morph.accepts(m[1]);
  }

  /** Spellings the morphology accepts, simplest analysis first (mlmorph's ranking), at most max. */
  suggest(word: string, max = 5): string[] {
    const scored = new Map<string, number>();
    for (const strategy of STRATEGIES) {
      for (const c of strategy(word)) {
        if (!c || c === word || scored.has(c) || scored.size > 400) continue;
        if (!this.morph.accepts(c)) continue;
        const weights = this.morph.analyse(c, 4).map(analysisWeight);
        scored.set(c, weights.length ? Math.min(...weights) : 9999);
      }
    }
    const best = [...scored.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c);
    if (best.length) return best.slice(0, max);
    // two words written together? (mlmorph tries a split after the third letter)
    const ch = [...word];
    for (let i = 3; i < ch.length - 3; i++) {
      const l = ch.slice(0, i).join("");
      const r = ch.slice(i).join("");
      if (this.morph.accepts(l) && this.morph.accepts(r)) return [`${l} ${r}`];
    }
    return [];
  }
}

/** Malayalam words in a text with their offsets (letters, signs, joiners). */
export function malayalamWords(text: string): { word: string; from: number; to: number }[] {
  const out: { word: string; from: number; to: number }[] = [];
  for (const m of text.matchAll(/[ഀ-ൿ‌‍]+/gu)) {
    const w = m[0].replace(/^[‌‍]+|[‌‍]+$/gu, "");
    if ([...w].length < 2) continue;
    out.push({ word: w, from: m.index!, to: m.index! + m[0].length });
  }
  return out;
}
