"use client";
/**
 * Spelling check in the browser: word lists from /dict/words, the writer's own words on this device,
 * and the mlmorph engine on the server (lib/spell-engine.ts) when it can be reached.
 */
import { BASE } from "./config";
import { loadIndex } from "./dictionary";
import { mlShardName } from "@litma/shared/dict";
import { createSpeller, type SpellIssue } from "@litma/shared/spell";
import { spellEngine } from "./spell-engine";
import { loadManglishWords, spellWords } from "./manglish-words";

const speller = createSpeller(
  (path) =>
    fetch(`${BASE}/dict/${path}.txt`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null),
  loadIndex,
  mlShardName
);

const LS_MINE = "litma:my-words";
const LS_PREFS = "litma:spell";
export const SPELL_EVENT = "litma:spell";

export interface SpellPrefs {
  /** marks shown in the editor */
  on: boolean;
  /** also mark words the dictionary doesn't have */
  unknown: boolean;
  /** spacing around punctuation */
  punct: boolean;
}

export function spellPrefs(): SpellPrefs {
  try {
    return { on: true, unknown: false, punct: true, ...JSON.parse(localStorage.getItem(LS_PREFS) ?? "{}") };
  } catch {
    return { on: true, unknown: false, punct: true };
  }
}
export function setSpellPrefs(p: Partial<SpellPrefs>) {
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify({ ...spellPrefs(), ...p }));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(SPELL_EVENT));
}

/** Words the writer keeps (never marked again on this device). */
export function myWords(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_MINE) ?? "[]"));
  } catch {
    return new Set();
  }
}
export function addMyWord(w: string) {
  const s = myWords();
  s.add(w);
  try {
    localStorage.setItem(LS_MINE, JSON.stringify([...s].slice(-5000)));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(SPELL_EVENT));
}

/**
 * Words left as written ("Ignore" on a suggestion). They are kept with the open work
 * (`settings.spellIgnored`, saved with it, so a refresh or another device keeps them) through the
 * saver the editor sets; without an open work they last for the visit.
 */
const ignored = new Set<string>();
let saveIgnored: ((words: string[]) => void) | null = null;
/** The open work's ignored words and how to save more (null when the work closes). */
export function setWorkIgnored(words: string[], save: ((words: string[]) => void) | null) {
  ignored.clear();
  for (const w of words) ignored.add(w);
  saveIgnored = save;
  window.dispatchEvent(new Event(SPELL_EVENT));
}
export function ignoreWord(w: string) {
  if (ignored.has(w)) return;
  ignored.add(w);
  saveIgnored?.([...ignored].slice(-1000));
  window.dispatchEvent(new Event(SPELL_EVENT));
}

/** The open work's Story World names: the writer's own words, never marked as unknown. */
let storyWords = new Set<string>();
export function setStoryWords(words: string[]) {
  storyWords = new Set(words);
  window.dispatchEvent(new Event(SPELL_EVENT));
}

/** The check the editor runs on each text block. */
export function blockChecker(): (text: string) => Promise<SpellIssue[]> {
  const p = spellPrefs();
  const mine = new Set([...myWords(), ...ignored, ...storyWords]);
  const skip = new Set(ignored);
  // the offline word list ranks the fixes and catches typos the engine has nothing for; until it
  // has loaded the check runs without it, and checks again once it is there
  const words = spellWords();
  if (!words) void loadManglishWords().then(() => spellWords() && window.dispatchEvent(new Event(SPELL_EVENT)));
  return async (text) =>
    (await speller.check(text, { unknown: p.unknown, mine, engine: spellEngine, punctuation: p.punct, words: words ?? undefined })).filter((i) => i.kind === "punct" || !skip.has(i.text));
}
