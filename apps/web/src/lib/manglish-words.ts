/**
 * Ranked offline Manglish suggestions in the browser and the desktop app.
 *
 * The word list (/dict/manglish-words.txt, ~1 MB compressed, kept for offline use by the service
 * worker and by the desktop app's `kept()`) loads the first time Manglish is used and the index is
 * built in idle moments, so typing never waits. Until it is ready, and if it can't be loaded,
 * suggestions are today's letter readings (manglishCandidates).
 */
import { manglishCandidates } from "@litma/shared/manglish";
import { buildManglishRanker, parseWordList, type ManglishRanker } from "@litma/shared/manglish-rank";
import { BASE } from "./config";

/** How many offline spellings the editor offers (Google's list, when it comes, can be longer). */
export const OFFLINE_MAX = 8;

let ranker: ManglishRanker | null = null;
let loading: Promise<void> | null = null;

const idle = () =>
  new Promise<void>((resolve) => {
    const w = typeof window !== "undefined" ? (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }) : null;
    if (w?.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 0);
  });

/** Start loading the word list (once). Safe to call on every keystroke. */
export function loadManglishWords(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetch(`${BASE}/dict/manglish-words.txt`);
      if (!r.ok) throw new Error(String(r.status));
      const words = parseWordList(await r.text());
      if (words.length) ranker = await buildManglishRanker(words, idle);
    } catch {
      loading = null; // try again next time Manglish is used
    }
  })();
  return loading;
}

/** Offline spellings for a Manglish word, best first. */
export function offlineCandidates(word: string, max = 6): string[] {
  if (!ranker) {
    void loadManglishWords();
    return manglishCandidates(word, max);
  }
  try {
    return ranker.suggest(word, max);
  } catch {
    return manglishCandidates(word, max);
  }
}

/** True once ranked suggestions are available (for tests). */
export const manglishWordsReady = () => ranker !== null;
