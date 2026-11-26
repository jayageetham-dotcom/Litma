/**
 * Malayalam spelling check (first stage): no grammar rules, no guessing at style.
 * - "unicode": letters typed in an old or broken way that look right but search and sort wrongly
 *   (ന + ് + ZWJ for ൻ, a vowel sign typed in two halves, a colon for visarga ഃ, stray joiners).
 * - "mistake": a short list of words commonly misspelt, with the standard spelling.
 * - "unknown" (only when the writer asks for it): a word the dictionary doesn't have, even after
 *   taking off common endings. Malayalam joins words freely and every region and community has its
 *   own words, so an unknown word is never called wrong; the writer can keep it ("Add to my words").
 *
 * - "suspect" (with the morphology engine, litma-spell + mlmorph.ts): a word the engine doesn't know
 *   but that is close to words it does, offered as "Check spelling?" with those spellings.
 * - "punct": spacing around punctuation (punctuation.ts).
 *
 * Grammar beyond that goes to the AI (the grammarCheck action in ai-prompts.ts).
 * Dependency-free: shared by the web app and the MCP server; the phone app ports it in
 * lib/data/spell.dart (keep the two in step, same cases in test/spell_test.dart).
 */

import { punctuationIssues } from "./punctuation.ts";

export type SpellKind = "unicode" | "mistake" | "suspect" | "punct" | "unknown";

export interface SpellIssue {
  /** offsets in the checked text */
  from: number;
  to: number;
  text: string;
  kind: SpellKind;
  /** suggested replacements, best first */
  fix: string[];
  /** for "punct": which rule (spaceBefore, spaceAfter, doubleSpace, doubleComma) */
  rule?: string;
}

/**
 * What the morphology engine (litma-spell, mlmorph.ts) says about a word: "ok", a listed "mistake",
 * a "suspect" (unknown, with close spellings it knows) or "unknown". null: the engine isn't reachable.
 */
export interface EngineVerdict {
  k: "ok" | "mistake" | "suspect" | "unknown";
  fix?: string[];
}
export type SpellEngine = (words: string[]) => Promise<Map<string, EngineVerdict> | null>;

const ZWJ = "‍";
const ZWNJ = "‌";
const VIRAMA = "്";

/** Old-style chillu (consonant + virama + ZWJ) → the atomic chillu letter. */
const OLD_CHILLU: [string, string][] = [
  ["ന" + VIRAMA + ZWJ, "ൻ"],
  ["ണ" + VIRAMA + ZWJ, "ൺ"],
  ["ര" + VIRAMA + ZWJ, "ർ"],
  ["ല" + VIRAMA + ZWJ, "ൽ"],
  ["ള" + VIRAMA + ZWJ, "ൾ"],
  ["ക" + VIRAMA + ZWJ, "ൿ"],
];
/** Vowel signs typed in two parts → the single sign. */
const SPLIT_SIGNS: [string, string][] = [
  ["ൊ", "ൊ"], // െ + ാ → ൊ
  ["ോ", "ോ"], // േ + ാ → ോ
  ["ൌ", "ൌ"], // െ + ൗ → ൌ
];

/** The word in Unicode as it should be typed, or null when it's already fine. */
export function unicodeFix(word: string): string | null {
  let w = word;
  for (const [a, b] of OLD_CHILLU) w = w.split(a).join(b);
  for (const [a, b] of SPLIT_SIGNS) w = w.split(a).join(b);
  // a joiner only belongs right after a virama
  w = w.replace(new RegExp(`(^|[^${VIRAMA}])[${ZWJ}${ZWNJ}]+`, "g"), "$1");
  // the same vowel sign or virama twice
  w = w.replace(/([ാ-്ൗ])\1+/g, "$1");
  return w === word ? null : w;
}

/**
 * Words commonly misspelt → the standard spelling. Only clear-cut cases, and only misspellings the
 * dictionary itself doesn't list (a spelling Olam or Datuk has, like ഉദ്ദേശം beside ഉദ്ദേശ്യം, is
 * never marked). Where usage is divided (പൂർവ്വം / പൂർവം) neither is marked.
 */
export const MISTAKES: Record<string, string> = {
  "ഉൽഘാടനം": "ഉദ്ഘാടനം",
  "അത്യന്താപേക്ഷികം": "അത്യന്താപേക്ഷിതം",
  "കവയത്രി": "കവയിത്രി",
  "സ്വാന്തനം": "സാന്ത്വനം",
  "മാനസീകം": "മാനസികം",
  "സാമ്പത്തീകം": "സാമ്പത്തികം",
  "ശാരീരീകം": "ശാരീരികം",
  "യഥാർഥ്യം": "യാഥാർഥ്യം",
  "പ്രസ്ഥാവന": "പ്രസ്താവന",
  "അനുഗ്രഹീത": "അനുഗൃഹീത",
  "ആവിശ്യം": "ആവശ്യം",
  "മുഖാന്തിരം": "മുഖാന്തരം",
  "പ്രാരാബ്ദം": "പ്രാരബ്ധം",
  "വിഢ്ഢി": "വിഡ്ഢി",
  "അഥിതി": "അതിഥി",
  "പ്രവർത്തിദിനം": "പ്രവൃത്തിദിനം",
  "വ്യത്യസ്ഥം": "വ്യത്യസ്തം",
  "അവസ്ത": "അവസ്ഥ",
  "നിവർത്തിയില്ല": "നിവൃത്തിയില്ല",
  "അദ്യക്ഷൻ": "അധ്യക്ഷൻ",
  "പുനഃരാരംഭം": "പുനരാരംഭം",
  "പുനഃരധിവാസം": "പുനരധിവാസം",
};

/** Endings to take off before looking a word up, longest first, with ways to restore the stem. */
const ENDINGS = [
  "ത്തിന്റെ", "ത്തിൻ്റെ", "ങ്ങളുടെ", "ങ്ങളിൽ", "ങ്ങളെ", "ങ്ങൾക്ക്", "ങ്ങൾ", "കളുടെ", "കളിൽ", "കളെ", "കൾക്ക്", "കൾ",
  "ത്തിൽ", "ത്തിന്", "ത്തെ", "ത്താൽ", "ത്തോട്", "ത്തിലേക്ക്",
  "യുടെ", "ിന്റെ", "ിൻ്റെ", "ന്റെ", "ൻ്റെ", "ുടെ", "ിലേക്ക്", "ിലൂടെ", "ിൽനിന്ന്", "ിൽ", "ിന്", "യ്ക്ക്", "ക്ക്", "ോട്", "ാൽ", "െ", "ും", "ോ", "േ", "ാണ്", "ായി", "മായി", "മായ", "മാണ്", "യും", "യോ",
  "ുന്നു", "ുന്ന", "ുമ്പോൾ", "ിച്ചു", "ിച്ച", "ിക്കുന്നു", "ിക്കും", "ിക്കുക", "ിക്കാൻ", "ുകയാണ്", "ുകയും", "ുക", "ും", "ാൻ", "ി", "ു",
];

/** The forms a word may come from once an ending is taken off. */
export function stems(word: string): string[] {
  const out = new Set<string>();
  for (const e of ENDINGS) {
    if (!word.endsWith(e) || [...word].length - [...e].length < 2) continue;
    const base = word.slice(0, -e.length);
    out.add(base);
    out.add(base + "ം");
    out.add(base + "്");
    out.add(base + "ു");
    out.add(base + "ക");
    out.add(base + "ുക");
    out.add(base + "ിക്കുക");
    if (base.endsWith("ത്ത")) out.add(base.slice(0, -3) + "ം");
    if (base.endsWith("ട്ട")) out.add(base.slice(0, -3) + "ട്");
    if (base.endsWith("റ്റ")) out.add(base.slice(0, -3) + "റ്");
    if (base.endsWith("യ")) out.add(base.slice(0, -1));
    if (base.endsWith("വ")) out.add(base.slice(0, -1));
  }
  out.delete(word);
  return [...out];
}

/**
 * A known misspelling: the word itself, or (exact = false) an inflected form starting with it
 * (ഉൽഘാടനത്തിന് → ഉദ്ഘാടനത്തിന്). Inflected forms are only marked when the dictionary doesn't
 * know the word either (see check).
 */
export function mistakeFix(word: string): { fix: string; exact: boolean } | null {
  if (MISTAKES[word]) return { fix: MISTAKES[word], exact: true };
  for (const [bad, good] of Object.entries(MISTAKES)) {
    // compare without the final ം / ്, which the endings replace
    const b = bad.replace(/[ം്]$/, "");
    const g = good.replace(/[ം്]$/, "");
    if ([...b].length >= 6 && word.startsWith(b) && !word.startsWith(g)) return { fix: g + word.slice(b.length), exact: false };
  }
  return null;
}

const WORD = /[ഀ-ൿ‌‍]+/g;

/** Every Malayalam word in a text with its offsets. */
export function words(text: string): { word: string; from: number; to: number }[] {
  const out: { word: string; from: number; to: number }[] = [];
  for (const m of text.matchAll(WORD)) out.push({ word: m[0], from: m.index ?? 0, to: (m.index ?? 0) + m[0].length });
  return out;
}

export interface SpellOptions {
  /** also mark words the dictionary doesn't know */
  unknown?: boolean;
  /** the writer's own words and ones they chose to ignore */
  mine?: Set<string>;
  /** the morphology engine; without it (or when it can't be reached) only the rules below run */
  engine?: SpellEngine;
  /** punctuation and spacing rules (punctuation.ts) */
  punctuation?: boolean;
  /**
   * The offline word list (manglish-rank.ts), once loaded: ranks the engine's fixes by real use and
   * adds sound-alike words; asks about an unknown word one letter from a common word. Optional.
   */
  words?: SpellWords;
}

/** What the spelling check uses from the offline word list (ManglishRanker has both). */
export interface SpellWords {
  rankFixes(word: string, fixes: string[], max?: number): string[];
  closeWords(word: string): string[];
}

/** Fetch a text file relative to the /dict root (e.g. "words/d15-d3e"); null when missing. */
export type SpellFetch = (path: string) => Promise<string | null>;
export type IndexFetch = () => Promise<{ mlSplit?: string[] } | null>;

export function createSpeller(fetchText: SpellFetch, fetchIndex: IndexFetch, shardName: (w: string, split: string[]) => string) {
  const shards = new Map<string, Promise<Set<string>>>();
  const shard = async (w: string) => {
    const idx = await fetchIndex();
    const name = shardName(w, idx?.mlSplit ?? []);
    let s = shards.get(name);
    if (!s) {
      s = fetchText(`words/${name}`)
        .then((t) => new Set((t ?? "").split("\n").filter(Boolean)))
        .catch(() => new Set<string>());
      shards.set(name, s);
    }
    return s;
  };
  const known = new Map<string, Promise<boolean>>();
  /** The dictionary has the word, or the word it comes from. Unknown when the data can't load: true. */
  function isKnown(w: string): Promise<boolean> {
    let k = known.get(w);
    if (!k) {
      k = (async () => {
        const s = await shard(w);
        if (!s.size) return true;
        if (s.has(w)) return true;
        for (const c of stems(w)) if ((await shard(c)).has(c)) return true;
        return false;
      })();
      known.set(w, k);
    }
    return k;
  }

  /** Issues in a text (a line or a paragraph). */
  async function check(text: string, opts: SpellOptions = {}): Promise<SpellIssue[]> {
    const out: SpellIssue[] = [];
    // a colon typed for visarga: ദു:ഖം → ദുഃഖം (the whole word, so the list shows what changes)
    const joined: [number, number][] = [];
    for (const m of text.matchAll(/([\u0D00-\u0D7F\u200C\u200D]+):([\u0D00-\u0D7F\u200C\u200D]+)/g)) {
      const at = m.index ?? 0;
      joined.push([at, at + m[0].length]);
      out.push({ from: at, to: at + m[0].length, text: m[0], kind: "unicode", fix: [`${m[1]}ഃ${m[2]}`] });
    }
    const list = words(text).filter(({ word, from, to }) => !joined.some(([x, y]) => from >= x && to <= y) && !opts.mine?.has(word));
    // one request to the engine for the block's words (it caches; null when it can't be reached)
    const verdicts = opts.engine ? await opts.engine([...new Set(list.map((w) => w.word))]).catch(() => null) : null;
    for (const { word, from, to } of list) {
      const u = unicodeFix(word);
      if (u) {
        out.push({ from, to, text: word, kind: "unicode", fix: [u] });
        continue;
      }
      const m = mistakeFix(word);
      if (m && (m.exact || !(await isKnown(word)))) {
        out.push({ from, to, text: word, kind: "mistake", fix: [m.fix] });
        continue;
      }
      const v = verdicts?.get(word);
      if (v && v.k !== "ok") {
        // the dictionary (or a word it comes from) knows it: never marked
        if (v.k !== "mistake" && (await isKnown(word))) continue;
        if (v.k === "mistake" && v.fix?.length) {
          out.push({ from, to, text: word, kind: "mistake", fix: v.fix });
          continue;
        }
        if (v.k === "suspect" && v.fix?.length) {
          out.push({ from, to, text: word, kind: "suspect", fix: opts.words ? opts.words.rankFixes(word, v.fix, 4) : v.fix.slice(0, 4) });
          continue;
        }
      }
      if (v?.k === "ok") continue;
      // nobody knows it, and a common word is one letter away: probably a typo, so ask (with or
      // without the engine). Names and new words rarely sit that close to a common word.
      const close = opts.words && [...word].length > 2 ? opts.words.closeWords(word) : [];
      if (close.length && !(await isKnown(word))) {
        out.push({ from, to, text: word, kind: "suspect", fix: close });
        continue;
      }
      if (opts.unknown && [...word].length > 2 && !(await isKnown(word))) out.push({ from, to, text: word, kind: "unknown", fix: [] });
    }
    if (opts.punctuation) for (const p of punctuationIssues(text)) out.push({ from: p.from, to: p.to, text: p.text, kind: "punct", fix: [p.fix], rule: p.rule });
    return out.sort((a, b) => a.from - b.from);
  }

  return { check, isKnown };
}
