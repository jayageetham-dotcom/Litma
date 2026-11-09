"use client";
/** Spelling check in the browser: word lists from /dict/words, the writer's own words on this device. */
import { BASE } from "./config";
import { loadIndex } from "./dictionary";
import { mlShardName } from "@litma/shared/dict";
import { createSpeller, type SpellIssue } from "@litma/shared/spell";

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
}

export function spellPrefs(): SpellPrefs {
  try {
    return { on: true, unknown: false, ...JSON.parse(localStorage.getItem(LS_PREFS) ?? "{}") };
  } catch {
    return { on: true, unknown: false };
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

/** The check the editor runs on each text block. */
export function blockChecker(): (text: string) => Promise<SpellIssue[]> {
  const p = spellPrefs();
  const mine = myWords();
  return (text) => speller.check(text, { unknown: p.unknown, mine });
}
