/**
 * Metre (വൃത്തം) of Malayalam verse: syllables with their laghu / guru weight, and the metre a
 * stanza is written in, with the syllables that don't fit it. Dependency-free; the phone app's
 * lib/core/metre_check.dart is a port (same answers, checked by test/metre_test.dart).
 *
 * Rules (Vrittamanjari, A. R. Raja Raja Varma, 1904):
 * - a short vowel is laghu (∪), a long vowel guru (–); ം, ഃ or a chillu after it make it guru;
 *   a short syllable before a conjunct (കൂട്ടക്ഷരം) is guru, across a space too;
 * - a word-final ് (samvruthokaram: അത്, പാട്ട്) is read either as a short syllable or not
 *   counted at all, as poets do both; when it isn't counted the syllable before it is closed, so
 *   guru. The checker takes whichever reading fits the metre;
 * - the last syllable of a line (pada) may be either.
 *
 * Sanskrit metres (സമവൃത്തം, അർദ്ധസമവൃത്തം, അനുഷ്ടുപ്പ്) are fixed laghu–guru patterns and are
 * named only when every line fits, or "close" when a few syllables are off. Malayalam metres
 * (ഭാഷാവൃത്തം) are sung, so they are recognised from the number of aksharas and the ganas in each
 * pair of lines and named as "likely". A stanza in no known metre is fine: free verse needs none.
 */

export type Weight = "L" | "G";

export interface Syllable {
  text: string;
  /** offsets in the line */
  start: number;
  end: number;
  /** weight when the syllable is counted */
  w: Weight;
  /** a word-final ് that may also be left uncounted */
  optional: boolean;
}

const VIRAMA = "്";
const ZWJ = "\u200D";
const ZWNJ = "\u200C";
const isCons = (c: string | undefined) => !!c && ((c >= "ക" && c <= "ഹ") || c === "ഺ");
const isVowel = (c: string | undefined) => !!c && ((c >= "അ" && c <= "ഔ") || c === "ൠ" || c === "ൡ");
const LONG_VOWELS = "ആഈഊൠഏഐഓഔൡ";
/** vowel signs, virama, ം ഃ ഁ */
const isSign = (c: string | undefined) =>
  !!c && ((c >= "ാ" && c <= "്") || c === "ൗ" || c === "ൢ" || c === "ൣ" || (c >= "ഁ" && c <= "ഃ"));
const LONG_SIGNS = "ാീൂൄേൈോൌൗൣ";
const isChillu = (c: string | undefined) => !!c && ((c >= "ൺ" && c <= "ൿ") || (c >= "ൔ" && c <= "ൖ") || c === "ൎ");
const isLetter = (c: string | undefined) => isCons(c) || isVowel(c) || isSign(c) || isChillu(c) || c === ZWJ || c === ZWNJ;

/** The syllables (aksharas) of one line with their weight. */
export function scanLine(line: string): Syllable[] {
  const out: Syllable[] = [];
  const n = line.length;
  let i = 0;
  while (i < n) {
    const c = line[i];
    // a chillu (ൽ, or the old ല്\u200D) closes the syllable before it
    const oldChillu = isCons(c) && line[i + 1] === VIRAMA && line[i + 2] === ZWJ;
    if (isChillu(c) || oldChillu) {
      const len = oldChillu ? 3 : 1;
      const prev = out[out.length - 1];
      if (prev && prev.end === i) {
        prev.end = i + len;
        prev.text = line.slice(prev.start, prev.end);
      }
      i += len;
      // ൻ്റ is the conjunct ന്റ: its virama belongs to the chillu
      if (line[i] === VIRAMA) {
        if (prev && prev.end === i) {
          prev.end = i + 1;
          prev.text = line.slice(prev.start, prev.end);
        }
        i++;
      }
      continue;
    }
    if (!isCons(c) && !isVowel(c)) {
      i++;
      continue;
    }
    const start = i;
    let j = i;
    if (isCons(c)) {
      // a conjunct: consonant ് consonant …
      while (isCons(line[j]) && line[j + 1] === VIRAMA && isCons(line[j + 2])) j += 2;
    }
    j++;
    while (j < n && (isSign(line[j]) || line[j] === ZWJ || line[j] === ZWNJ)) j++;
    const text = line.slice(start, j);
    const wordEnd = !isLetter(line[j]) || line[j] === ZWNJ || text.endsWith(ZWNJ);
    const bare = text.replace(/[\u200C\u200D]/g, "");
    out.push({ text, start, end: j, w: "L", optional: isCons(c) && bare.endsWith(VIRAMA) && wordEnd });
    i = j;
  }
  for (let k = 0; k < out.length; k++) {
    const s = out[k];
    const t = s.text;
    let long =
      LONG_VOWELS.includes(t[0]) ||
      [...t].some((ch) => LONG_SIGNS.includes(ch) || ch === "ം" || ch === "ഃ" || isChillu(ch)) ||
      /[ക-ഺ]്\u200D/.test(t);
    const next = out[k + 1]?.text;
    // before a conjunct (also across a space: the next syllable starts with consonant ് consonant)
    if (!long && !s.optional && next && isCons(next[0]) && next[1] === VIRAMA && isCons(next[2])) long = true;
    s.w = long ? "G" : "L";
  }
  return out;
}

/** One way to read a line: the syllables counted (indexes into the scan) and their weights. */
export interface Reading {
  idx: number[];
  w: string;
}

/** Every reading of a line: each word-final ് counted (short) or not (the syllable before turns guru). */
export function readings(syls: Syllable[]): Reading[] {
  const opt: number[] = [];
  syls.forEach((s, k) => {
    if (s.optional && k > 0 && opt.length < 8) opt.push(k);
  });
  const seen = new Set<string>();
  const out: Reading[] = [];
  // fewest dropped first, so the plain reading wins ties
  const masks = Array.from({ length: 1 << opt.length }, (_, m) => m).sort((a, b) => bits(a) - bits(b) || a - b);
  for (const m of masks) {
    const drop = new Set(opt.filter((_, b) => m & (1 << b)));
    const idx: number[] = [];
    const w: Weight[] = [];
    syls.forEach((s, k) => {
      if (drop.has(k)) {
        if (w.length) w[w.length - 1] = "G";
        return;
      }
      idx.push(k);
      w.push(s.w);
    });
    const key = w.join("") + ":" + idx.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ idx, w: w.join("") });
  }
  return out;
}

function bits(m: number): number {
  let c = 0;
  for (; m; m >>= 1) c += m & 1;
  return c;
}

// ─── Metres ──────────────────────────────────────────────────────────────

/** Gana letters (Y M T R J B N S, L G) → laghu–guru. */
const GANA: Record<string, string> = { Y: "LGG", M: "GGG", T: "GGL", R: "GLG", J: "LGL", B: "GLL", N: "LLL", S: "LLG", L: "L", G: "G" };
/** The gana a group of three is (for showing a line's ganas). */
export const GANA_ML: Record<string, string> = {
  LGG: "യ",
  GGG: "മ",
  GGL: "ത",
  GLG: "ര",
  LGL: "ജ",
  GLL: "ഭ",
  LLL: "ന",
  LLG: "സ",
  L: "ല",
  G: "ഗ",
};
const pattern = (ganas: string) => [...ganas].map((g) => GANA[g]).join("");

export type MetreKind = "sama" | "ardhasama" | "upajati" | "anushtup" | "bhasha";

export interface Metre {
  id: string;
  /** Malayalam name */
  ml: string;
  /** the name in Latin letters */
  en: string;
  kind: MetreKind;
  /** sama: gana letters of every line; ardhasama: of the odd lines */
  ganas?: string;
  /** ardhasama: gana letters of the even lines */
  even?: string;
  /** upajati: the two metres mixed */
  of?: [string, string];
  /** bhasha: aksharas in the first and second line of each pair */
  counts?: [number[], number[]];
  /** bhasha: aksharas in each gana (shown as groups) */
  groups?: number[];
}

/** Sanskrit metres used in Malayalam poetry, shortest first. */
export const SAMA: Metre[] = [
  { id: "vidyunmala", ml: "വിദ്യുന്മാല", en: "Vidyunmala", kind: "sama", ganas: "MMGG" },
  { id: "pramanika", ml: "പ്രമാണിക", en: "Pramanika", kind: "sama", ganas: "JRLG" },
  { id: "indravajra", ml: "ഇന്ദ്രവജ്ര", en: "Indravajra", kind: "sama", ganas: "TTJGG" },
  { id: "upendravajra", ml: "ഉപേന്ദ്രവജ്ര", en: "Upendravajra", kind: "sama", ganas: "JTJGG" },
  { id: "rathoddhata", ml: "രഥോദ്ധത", en: "Rathoddhata", kind: "sama", ganas: "RNRLG" },
  { id: "swagata", ml: "സ്വാഗത", en: "Swagata", kind: "sama", ganas: "RNBGG" },
  { id: "shalini", ml: "ശാലിനി", en: "Shalini", kind: "sama", ganas: "MTTGG" },
  { id: "dodhakam", ml: "ദോധകം", en: "Dodhakam", kind: "sama", ganas: "BBBGG" },
  { id: "kalyani", ml: "കല്യാണി", en: "Kalyani", kind: "sama", ganas: "TTTGG" },
  { id: "vamsastham", ml: "വംശസ്ഥം", en: "Vamsastham", kind: "sama", ganas: "JTJR" },
  { id: "indravamsa", ml: "ഇന്ദ്രവംശ", en: "Indravamsa", kind: "sama", ganas: "TTJR" },
  { id: "drutavilambitam", ml: "ദ്രുതവിളംബിതം", en: "Drutavilambitam", kind: "sama", ganas: "NBBR" },
  { id: "todakam", ml: "തോടകം", en: "Todakam", kind: "sama", ganas: "SSSS" },
  { id: "bhujangaprayatam", ml: "ഭുജംഗപ്രയാതം", en: "Bhujangaprayatam", kind: "sama", ganas: "YYYY" },
  { id: "sragvini", ml: "സ്രഗ്വിണി", en: "Sragvini", kind: "sama", ganas: "RRRR" },
  { id: "pramitakshara", ml: "പ്രമിതാക്ഷര", en: "Pramitakshara", kind: "sama", ganas: "SJSS" },
  { id: "manjubhashini", ml: "മഞ്ജുഭാഷിണി", en: "Manjubhashini", kind: "sama", ganas: "SJSJG" },
  { id: "praharshini", ml: "പ്രഹർഷിണി", en: "Praharshini", kind: "sama", ganas: "MNJRG" },
  { id: "ruchira", ml: "രുചിര", en: "Ruchira", kind: "sama", ganas: "JBSJG" },
  { id: "vasantatilakam", ml: "വസന്തതിലകം", en: "Vasantatilakam", kind: "sama", ganas: "TBJJGG" },
  { id: "malini", ml: "മാലിനി", en: "Malini", kind: "sama", ganas: "NNMYY" },
  { id: "panchachamaram", ml: "പഞ്ചചാമരം", en: "Panchachamaram", kind: "sama", ganas: "JRJRJG" },
  { id: "shikharini", ml: "ശിഖരിണി", en: "Shikharini", kind: "sama", ganas: "YMNSBLG" },
  { id: "prithvi", ml: "പൃഥ്വി", en: "Prithvi", kind: "sama", ganas: "JSJSYLG" },
  { id: "mandakranta", ml: "മന്ദാക്രാന്ത", en: "Mandakranta", kind: "sama", ganas: "MBNTTGG" },
  { id: "harini", ml: "ഹരിണി", en: "Harini", kind: "sama", ganas: "NSMRSLG" },
  { id: "shardulavikriditam", ml: "ശാർദ്ദൂലവിക്രീഡിതം", en: "Shardulavikriditam", kind: "sama", ganas: "MSJSTTG" },
  { id: "sragdhara", ml: "സ്രഗ്ദ്ധര", en: "Sragdhara", kind: "sama", ganas: "MRBNYYY" },
];

export const ARDHASAMA: Metre[] = [
  { id: "viyogini", ml: "വിയോഗിനി", en: "Viyogini", kind: "ardhasama", ganas: "SSJG", even: "SBRLG" },
  { id: "pushpitagra", ml: "പുഷ്പിതാഗ്ര", en: "Pushpitagra", kind: "ardhasama", ganas: "NNRY", even: "NJJRG" },
];

export const UPAJATI: Metre[] = [
  { id: "upajati", ml: "ഉപജാതി", en: "Upajati", kind: "upajati", of: ["indravajra", "upendravajra"] },
  { id: "upajati-vamsa", ml: "ഉപജാതി", en: "Upajati", kind: "upajati", of: ["vamsastham", "indravamsa"] },
];

export const ANUSHTUP: Metre = { id: "anushtup", ml: "അനുഷ്ടുപ്പ്", en: "Anushtup (shloka)", kind: "anushtup" };

/** Malayalam metres, checked in this order (the more particular first). */
export const BHASHA: Metre[] = [
  { id: "manikanchi", ml: "മണികാഞ്ചി", en: "Manikanchi", kind: "bhasha", counts: [[14], [14]], groups: [5, 3, 3, 3] },
  { id: "keka", ml: "കേക", en: "Keka", kind: "bhasha", counts: [[14], [14]], groups: [3, 2, 2, 3, 2, 2] },
  { id: "annanada", ml: "അന്നനട", en: "Annanada", kind: "bhasha", counts: [[12], [12]], groups: [2, 2, 2, 2, 2, 2] },
  { id: "kakali", ml: "കാകളി", en: "Kakali", kind: "bhasha", counts: [[12], [12]], groups: [3, 3, 3, 3] },
  { id: "kalakanchi", ml: "കളകാഞ്ചി", en: "Kalakanchi", kind: "bhasha", counts: [[16, 18], [12]], groups: [3, 3, 3, 3] },
  { id: "manjari", ml: "മഞ്ജരി", en: "Manjari", kind: "bhasha", counts: [[12], [10]], groups: [3, 3, 3, 3] },
  { id: "unakakali", ml: "ഊനകാകളി", en: "Unakakali", kind: "bhasha", counts: [[12], [11]], groups: [3, 3, 3, 3] },
  { id: "marakakali", ml: "മാരകാകളി", en: "Marakakali", kind: "bhasha", counts: [[12], [8]], groups: [3, 3, 3, 3] },
  { id: "drutakakali", ml: "ദ്രുതകാകളി", en: "Drutakakali (Pana)", kind: "bhasha", counts: [[11], [11]], groups: [3, 3, 3, 2] },
  { id: "nathonnatha", ml: "നതോന്നത", en: "Nathonnatha", kind: "bhasha", counts: [[16], [13]], groups: [2, 2, 2, 2, 2, 2, 2, 2] },
  { id: "tharangini", ml: "തരംഗിണി", en: "Tharangini", kind: "bhasha" },
];

export const METRES: Metre[] = [...SAMA, ...ARDHASAMA, ...UPAJATI, ANUSHTUP, ...BHASHA];

/** The laghu–guru pattern a metre asks of a line (sama, ardhasama; odd = first, third… line). */
export function patternOf(m: Metre, odd = true): string {
  if (m.kind === "ardhasama") return pattern(odd ? m.ganas! : m.even!);
  if (m.ganas) return pattern(m.ganas);
  return "";
}

// ─── Checking ────────────────────────────────────────────────────────────

export interface CheckedSyllable extends Syllable {
  /** counted in the reading that fits best (a word-final ് may be left out) */
  counted: boolean;
  /** weight in that reading */
  weight: Weight;
  /** laghu where the metre asks guru, or the reverse */
  wrong: boolean;
  /** which gana (group) it is in, for showing the line in groups; -1 when not counted */
  group: number;
}

export interface LineCheck {
  text: string;
  syllables: CheckedSyllable[];
  /** syllables counted */
  count: number;
  /** laghu = 1, guru = 2 */
  matras: number;
  /** syllables the metre asks for this line (when a metre was found) */
  expected?: number;
  ok: boolean;
}

export type Fit = "exact" | "likely" | "close" | "none";

export interface MetreCheck {
  metre: Metre | null;
  fit: Fit;
  lines: LineCheck[];
  /** upajati: which of the two metres each line is */
  lineMetres?: string[];
}

interface Fitted {
  reading: Reading;
  wrong: number[]; // positions in the reading
  groups: number[]; // group sizes
}

/** Positions where a reading differs from a pattern (the last syllable of each pada is free). */
function mismatches(w: string, pat: string, padaEnds: number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < pat.length; k++) if (w[k] !== pat[k] && !padaEnds.includes(k)) out.push(k);
  return out;
}

/** The best reading of a line for a fixed pattern (one or two padas on the line). */
function fitPattern(rs: Reading[], pats: string[][]): Fitted | null {
  let best: Fitted | null = null;
  for (const padas of pats) {
    const pat = padas.join("");
    const ends: number[] = [];
    let acc = 0;
    for (const p of padas) ends.push((acc += p.length) - 1);
    for (const r of rs) {
      if (r.w.length !== pat.length) continue;
      const wrong = mismatches(r.w, pat, ends);
      if (!best || wrong.length < best.wrong.length) {
        const groups: number[] = [];
        for (const p of padas) {
          for (let k = 0; k + 3 <= p.length; k += 3) groups.push(3);
          for (let k = p.length - (p.length % 3); k < p.length; k++) groups.push(1);
        }
        best = { reading: r, wrong, groups };
      }
      if (best && !best.wrong.length) return best;
    }
  }
  return best;
}

/** The reading whose count is nearest one of the wanted counts (fewest dropped wins a tie). */
function nearestCount(rs: Reading[], counts: number[]): Reading {
  let best = rs[0];
  let d = Infinity;
  for (const r of rs) {
    const dd = Math.min(...counts.map((c) => Math.abs(r.w.length - c)));
    if (dd < d) {
      d = dd;
      best = r;
    }
  }
  return best;
}

function matras(w: string): number {
  let m = 0;
  for (const c of w) m += c === "G" ? 2 : 1;
  return m;
}

function anushtupWrong(w: string, start: number, odd: boolean): number[] {
  // in each pada of 8: the 5th laghu, the 6th guru, the 7th guru in odd padas and laghu in even ones
  const want: [number, Weight][] = [
    [4, "L"],
    [5, "G"],
    [6, odd ? "G" : "L"],
  ];
  return want.filter(([k, g]) => w[start + k] !== g).map(([k]) => start + k);
}

function lineResult(text: string, syls: Syllable[], r: Reading, wrong: number[], groups: number[], expected?: number): LineCheck {
  const pos = new Map<number, number>();
  r.idx.forEach((k, p) => pos.set(k, p));
  const groupOf: number[] = [];
  groups.forEach((g, gi) => {
    for (let k = 0; k < g; k++) groupOf.push(gi);
  });
  const out: CheckedSyllable[] = syls.map((s, k) => {
    const p = pos.get(k);
    return {
      ...s,
      counted: p !== undefined,
      weight: p !== undefined ? (r.w[p] as Weight) : s.w,
      wrong: p !== undefined && wrong.includes(p),
      group: p !== undefined ? groupOf[p] ?? -1 : -1,
    };
  });
  return {
    text,
    syllables: out,
    count: r.w.length,
    matras: matras(r.w),
    expected,
    ok: !wrong.length && (expected === undefined || expected === r.w.length),
  };
}

/** The plain scan of a line, without a metre (for the marks beside lines and unknown stanzas). */
export function plainLine(text: string): LineCheck {
  const syls = scanLine(text);
  const r = readings(syls)[0] ?? { idx: [], w: "" };
  return lineResult(text, syls, r, [], [], undefined);
}

/**
 * The metre of a stanza (its non-empty lines). Lines may hold one pada each or, for Sanskrit
 * metres, two (a half-verse on a line).
 */
export function checkStanza(raw: string[]): MetreCheck {
  const texts = raw.map((l) => l.trim()).filter((l) => scanLine(l).length > 0);
  const scans = texts.map(scanLine);
  const rs = scans.map(readings);
  const none = (): MetreCheck => ({ metre: null, fit: "none", lines: texts.map(plainLine) });
  if (!texts.length) return none();

  // Sanskrit metres: a fixed pattern per line
  type Cand = { m: Metre; fits: (Fitted | null)[]; names?: string[] };
  const cands: Cand[] = [];
  for (const m of SAMA) {
    const p = patternOf(m);
    cands.push({ m, fits: rs.map((r) => fitPattern(r, [[p], [p, p]])) });
  }
  for (const m of ARDHASAMA) {
    const o = patternOf(m, true);
    const e = patternOf(m, false);
    cands.push({ m, fits: rs.map((r, k) => fitPattern(r, [[k % 2 ? e : o], [o, e]])) });
  }
  const exact = (c: Cand) => c.fits.every((f) => f && !f.wrong.length);
  // upajati: two metres mixed line by line (each line fits one of them, and both appear)
  for (const u of UPAJATI) {
    const [a, b] = u.of!.map((id) => cands.find((c) => c.m.id === id)!);
    if (exact(a) || exact(b)) continue;
    const names: string[] = [];
    const fits = rs.map((_, k) => {
      const fa = a.fits[k];
      const fb = b.fits[k];
      if (fa && !fa.wrong.length) {
        names.push(a.m.id);
        return fa;
      }
      if (fb && !fb.wrong.length) {
        names.push(b.m.id);
        return fb;
      }
      names.push("");
      return fa && fb ? (fa.wrong.length <= fb.wrong.length ? fa : fb) : fa ?? fb;
    });
    if (names.includes(a.m.id) && names.includes(b.m.id)) cands.push({ m: u, fits, names });
  }
  const done = (c: Cand, fit: Fit): MetreCheck => ({
    metre: c.m,
    fit,
    lines: texts.map((t, k) => {
      const f = c.fits[k];
      if (!f) {
        const r = nearestCount(rs[k], [expectedOf(c.m, k, rs[k])]);
        return { ...lineResult(t, scans[k], r, [], []), expected: expectedOf(c.m, k, rs[k]), ok: false };
      }
      return lineResult(t, scans[k], f.reading, f.wrong, f.groups, f.reading.w.length);
    }),
    lineMetres: c.names,
  });
  const exacts = cands.filter(exact);
  if (exacts.length) return done(exacts[0], "exact");

  // അനുഷ്ടുപ്പ്: padas of eight, one or two on a line
  const anu = anushtup(texts, scans, rs);
  if (anu) return anu;

  // Malayalam metres
  const bh = bhasha(texts, scans, rs);
  if (bh) return bh;

  // close to a Sanskrit metre: every line has the right length, at most two syllables off in a
  // line, and at least half the lines fit
  let best: { c: Cand; wrong: number } | null = null;
  for (const c of cands) {
    if (!c.fits.every((f) => f && f.wrong.length <= 2)) continue;
    const wrong = c.fits.reduce((s, f) => s + f!.wrong.length, 0);
    const fine = c.fits.filter((f) => !f!.wrong.length).length;
    if (texts.length > 1 && fine * 2 < texts.length) continue;
    if (texts.length === 1 && wrong > 1) continue;
    if (!best || wrong < best.wrong) best = { c, wrong };
  }
  if (best) return done(best.c, "close");
  return none();
}

function expectedOf(m: Metre, k: number, _r: Reading[]): number {
  if (m.kind === "ardhasama") return patternOf(m, k % 2 === 0).length;
  return patternOf(m).length;
}

function anushtup(texts: string[], scans: Syllable[][], rs: Reading[][]): MetreCheck | null {
  if (texts.length < 2) return null;
  const lines: LineCheck[] = [];
  let pada = 0;
  for (let k = 0; k < texts.length; k++) {
    let got: { r: Reading; wrong: number[]; n: number } | null = null;
    for (const r of rs[k]) {
      if (r.w.length !== 8 && r.w.length !== 16) continue;
      const n = r.w.length / 8;
      const wrong: number[] = [];
      for (let p = 0; p < n; p++) wrong.push(...anushtupWrong(r.w, p * 8, (pada + p) % 2 === 0));
      if (!got || wrong.length < got.wrong.length) got = { r, wrong, n };
      if (!wrong.length) break;
    }
    if (!got || got.wrong.length) return null;
    pada += got.n;
    lines.push(lineResult(texts[k], scans[k], got.r, [], got.n === 2 ? [4, 4, 4, 4] : [4, 4], got.r.w.length));
  }
  return { metre: ANUSHTUP, fit: "exact", lines };
}

/**
 * Malayalam metres: aksharas per line in each pair of lines, and the shape of the ganas. When every
 * line fits but one whose count is a little off, the metre is "close" and that line is marked.
 */
function bhasha(texts: string[], scans: Syllable[][], rs: Reading[][]): MetreCheck | null {
  if (texts.length < 2) return null;
  let near: MetreCheck | null = null;
  for (const m of BHASHA) {
    const lines: LineCheck[] = [];
    let off = -1;
    let fail = false;
    for (let k = 0; k < texts.length && !fail; k++) {
      const second = k % 2 === 1;
      if (m.id === "tharangini") {
        // eight ganas of two matras: 16 matras a line (the last syllable may be stretched)
        const r = rs[k].find((x) => matras(x.w.slice(0, -1)) + 2 === 16 && x.w.length >= 8 && x.w.length <= 13);
        if (r) lines.push(lineResult(texts[k], scans[k], r, [], twoMatraGroups(r.w), r.w.length));
        else fail = true;
        continue;
      }
      const want = m.counts![second ? 1 : 0];
      const r = rs[k].find((x) => want.includes(x.w.length) && bhashaShape(m, x.w, second));
      if (r) {
        lines.push(lineResult(texts[k], scans[k], r, [], bhashaGroups(m, r.w.length, second), r.w.length));
        continue;
      }
      // one line may be off by a little
      const n = nearestCount(rs[k], want);
      const d = Math.min(...want.map((c) => Math.abs(c - n.w.length)));
      // (only with three lines or more: in a couplet one good line says too little)
      if (off >= 0 || d === 0 || d > 3 || texts.length < 3) {
        fail = true;
        continue;
      }
      off = k;
      const expected = want.reduce((a, c) => (Math.abs(c - n.w.length) < Math.abs(a - n.w.length) ? c : a));
      lines.push({ ...lineResult(texts[k], scans[k], n, [], bhashaGroups(m, n.w.length, second)), expected, ok: false });
    }
    if (fail || lines.length !== texts.length) continue;
    if (off < 0) return { metre: m, fit: "likely", lines };
    if (!near) near = { metre: m, fit: "close", lines };
  }
  return near;
}

function bhashaShape(m: Metre, w: string, second: boolean): boolean {
  switch (m.id) {
    case "manikanchi":
      // a kakali line whose first gana is five laghus
      return w.slice(0, 5) === "LLLLL" && kakaliGanas(w.slice(5));
    case "keka": {
      // 3 2 2 | 3 2 2 with a guru in every gana (the line's last syllable may be stretched)
      const g = cut(w.slice(0, -1) + "G", [3, 2, 2, 3, 2, 2]);
      return g.every((x) => x.includes("G"));
    }
    case "annanada": {
      // laghu then guru: always at the start of each half, mostly elsewhere
      const g = cut(w.slice(0, -1) + "G", [2, 2, 2, 2, 2, 2]);
      return g[0] === "LG" && g[3] === "LG" && g.filter((x) => x === "LG").length >= 4;
    }
    case "kakali":
    case "manjari":
    case "unakakali":
    case "marakakali":
    case "drutakakali":
      // three-akshara ganas of about five matras
      if (second && m.id !== "kakali" && m.id !== "drutakakali") return kakaliGanas(w.slice(0, Math.floor(w.length / 3) * 3), true);
      return kakaliGanas(w.slice(0, Math.floor(w.length / 3) * 3), m.id !== "kakali");
    case "kalakanchi":
      if (second) return kakaliGanas(w);
      // two or three ganas of five laghus, then kakali ganas
      return w.startsWith("L".repeat(10)) && kakaliGanas(w.slice(w.length === 18 ? 15 : 10));
    case "nathonnatha":
      return true;
    default:
      return false;
  }
}

/** Kakali ganas: three aksharas, five matras (four allowed in the looser kinds). */
function kakaliGanas(w: string, loose = false): boolean {
  const g = cut(w.slice(0, -1) + "G", Array(Math.floor(w.length / 3)).fill(3));
  const five = g.filter((x) => matras(x) === 5).length;
  return loose ? g.every((x) => matras(x) >= 4) && five * 2 >= g.length : g.every((x) => matras(x) >= 4) && five >= g.length - 1;
}

function cut(w: string, sizes: number[]): string[] {
  const out: string[] = [];
  let p = 0;
  for (const s of sizes) {
    out.push(w.slice(p, p + s));
    p += s;
  }
  return out;
}

function bhashaGroups(m: Metre, n: number, second: boolean): number[] {
  if (m.id === "kalakanchi" && !second) return n === 18 ? [5, 5, 5, 3] : [5, 5, 3, 3];
  const g = m.groups!;
  const out: number[] = [];
  let left = n;
  for (const s of g) {
    if (left <= 0) break;
    out.push(Math.min(s, left));
    left -= s;
  }
  if (left > 0) out.push(left);
  return out;
}

function twoMatraGroups(w: string): number[] {
  const out: number[] = [];
  let k = 0;
  while (k < w.length) {
    if (w[k] === "G" || k === w.length - 1) {
      out.push(1);
      k++;
    } else {
      out.push(2);
      k += 2;
    }
  }
  return out;
}

/** A stanza's lines split from a block of text: blank lines separate stanzas. */
export function stanzas(text: string): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const l of text.split(/\r?\n/)) {
    if (!l.trim()) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** "ത ഭ ജ ജ ഗ ഗ" for a metre's ganas. */
export function ganaNames(ganas: string): string {
  return [...ganas].map((g) => GANA_ML[GANA[g]]).join(" ");
}
