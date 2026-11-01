"use client";
/** Browser wrapper around the shared dictionary core: data is served from /litma/dict/. */
import { BASE } from "./config";
import { createDictionary, isMalayalam, type DictIndex, type LookupResult } from "@litma/shared/dict";
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
export const getEn = dict.getEn;
export const getMl = dict.getMl;
export { isMalayalam };

/** For a Latin query, the Malayalam words it may have been typed as (Manglish). */
export async function manglishCandidates(q: string): Promise<string[]> {
  if (isMalayalam(q) || !/^[A-Za-z~_^]+$/.test(q.trim())) return [];
  const r = await transliterate(q.trim(), 4);
  return [...new Set([...(r.candidates ?? []), manglishWord(q.trim())])].slice(0, 5);
}
