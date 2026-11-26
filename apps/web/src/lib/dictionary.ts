"use client";
/** Browser wrapper around the shared dictionary core: data is served from /dict/. */
import { BASE } from "./config";
import { createDictionary, isMalayalam, type DictIndex, type LookupResult } from "@litma/shared/dict";
import { createRhymes } from "@litma/shared/rhyme";
import { manglishWord } from "@litma/shared/manglish";
import { transliterate } from "./functions";

const dict = createDictionary((path) =>
  fetch(`${BASE}/dict/${path}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
);

export type { LookupResult };
export const loadIndex = (): Promise<DictIndex | null> => dict.index();
export const lookup = dict.lookup;
export const suggest = dict.suggest;
export const opposites = dict.opposites;
export const headFor = dict.headFor;
export const getEn = dict.getEn;
export const getMl = dict.getMl;
export { isMalayalam };

/** For a Latin query, the Malayalam words it may have been typed as (Manglish). */
export async function manglishCandidates(q: string): Promise<string[]> {
  if (isMalayalam(q) || !/^[A-Za-z~_^]+$/.test(q.trim())) return [];
  const r = await transliterate(q.trim(), 4);
  return [...new Set([...(r.candidates ?? []), manglishWord(q.trim())])].slice(0, 5);
}

/**
 * What to offer under the search box while the writer types (like Olam): for Manglish, the Malayalam
 * spellings that are dictionary words and words starting with the best spelling (`ml`); and dictionary
 * words starting with the typed letters, English or Malayalam (`words`).
 */
export async function typingSuggestions(q: string, max = 8): Promise<{ ml: string[]; words: string[] }> {
  const t = q.trim();
  if (t.length < 2) return { ml: [], words: [] };
  const [words, cands] = await Promise.all([suggest(t, max), manglishCandidates(t)]);
  if (!cands.length) return { ml: [], words };
  const top = cands.slice(0, 3);
  const lists = await Promise.all(top.map((c) => suggest(c, 5)));
  const ml: string[] = [];
  // spellings that are dictionary words first, in the order the transliterator ranks them
  top.forEach((c, i) => lists[i].includes(c) && ml.push(c));
  // then words that start with them (മഴ → മഴക്കാലം…)
  for (const list of lists) for (const w of list) if (!ml.includes(w)) ml.push(w);
  // none of them is in the dictionary: still offer the spellings, so the writer can try one
  // when the letters also start English words (hou → House), those lead and the Malayalam list is shorter
  return { ml: (ml.length ? ml : cands).slice(0, words.length ? 4 : 6), words: words.filter((w) => !ml.includes(w)) };
}

/** Rhyme finder (പ്രാസം): files built from the dictionary by scripts/build-rhymes.mjs. */
export const rhymes = createRhymes((path) =>
  fetch(`${BASE}/dict/${path}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
);
