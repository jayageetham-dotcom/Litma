/**
 * Ranked offline Manglish suggestions in the browser and the desktop app.
 *
 * The word list (/dict/manglish-words.txt, ~1 MB compressed, kept for offline use by the service
 * worker and by the desktop app's `kept()`) loads the first time Manglish is used and the index is
 * built in idle moments, so typing never waits. Until it is ready, and if it can't be loaded,
 * suggestions are today's letter readings (manglishCandidates).
 */
import { manglishCandidates } from "@litma/shared/manglish";
import { buildManglishRanker, ownWordsFrom, parseWordList, type ManglishRanker } from "@litma/shared/manglish-rank";
import { BASE } from "./config";

/** How many offline spellings the editor offers (Google's list, when it comes, can be longer). */
export const OFFLINE_MAX = 8;

let ranker: ManglishRanker | null = null;
let loading: Promise<void> | null = null;
/** The work's Story World names, kept until the word list is ready. */
let ownWords: string[] = [];

/** The open work's Story World names: suggested first when they fit (and never marked by spelling). */
export function setStoryNames(names: string[]) {
  ownWords = ownWordsFrom(names);
  ranker?.setOwnWords(ownWords);
}

// ---- spellings the writer chose themselves, remembered on this device
const LS_PICKS = "litma:manglish-picks";
const MAX_PICKS = 1000;
let picks: Map<string, string> | null = null;
function readPicks(): Map<string, string> {
  if (picks) return picks;
  try {
    picks = new Map(Object.entries(JSON.parse(localStorage.getItem(LS_PICKS) ?? "{}") as Record<string, string>));
  } catch {
    picks = new Map();
  }
  return picks;
}

/** The writer picked `choice` for the Manglish `word` (tapped it or arrowed to it): offer it first next time. */
export function rememberPick(word: string, choice: string) {
  if (!word || !choice || !/[\u0D00-\u0D7F]/.test(choice)) return;
  const p = readPicks();
  p.delete(word); // newest last, so the oldest go first when the list is full
  p.set(word, choice);
  while (p.size > MAX_PICKS) p.delete(p.keys().next().value as string);
  try {
    localStorage.setItem(LS_PICKS, JSON.stringify(Object.fromEntries(p)));
  } catch {
    /* storage blocked: remembered for this visit */
  }
}

/** A list with the writer's own earlier pick for `word` first (if there is one). */
export function withPick(word: string, list: string[]): string[] {
  const pick = readPicks().get(word);
  return pick ? [pick, ...list.filter((w) => w !== pick)] : list;
}

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
      if (words.length) {
        ranker = await buildManglishRanker(words, idle);
        ranker.setOwnWords(ownWords);
      }
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
    return withPick(word, manglishCandidates(word, max)).slice(0, max);
  }
  try {
    return withPick(word, ranker.suggest(word, max)).slice(0, max);
  } catch {
    return withPick(word, manglishCandidates(word, max)).slice(0, max);
  }
}

/** Known words that sound like a Malayalam word (spelling suggestions for an unknown word). */
export async function similarWords(word: string, max = 6): Promise<string[]> {
  try {
    await loadManglishWords();
    return ranker ? ranker.similar(word, max) : [];
  } catch {
    return [];
  }
}

/** True once ranked suggestions are available (for tests). */
export const manglishWordsReady = () => ranker !== null;
