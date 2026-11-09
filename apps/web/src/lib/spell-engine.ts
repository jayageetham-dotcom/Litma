"use client";
/**
 * Client for the litma-spell Edge Function (mlmorph morphology engine). The editor's spelling check
 * asks it about the words of each text block; answers are cached for the visit, requests from many
 * blocks are batched, and when the server can't be reached (offline, local mode, an error) the
 * check simply goes on with its own rules, so the editor never waits on it or breaks.
 */
import type { EngineVerdict, SpellEngine } from "@litma/shared/spell";
import { FUNCTIONS_URL, anonHeaders } from "./config";
import { getSupabase } from "./supabase/client";

const cache = new Map<string, EngineVerdict>();
let pausedUntil = 0; // after a failure, leave the server alone for a while
let queue: { words: string[]; done: (ok: boolean) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const MAX_WORDS = 600;

async function send(words: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !FUNCTIONS_URL) return false;
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${FUNCTIONS_URL}/litma-spell`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...anonHeaders() },
      body: JSON.stringify({ words }),
    });
    if (!r.ok) return false;
    const body = (await r.json()) as { verdicts?: Record<string, EngineVerdict> };
    for (const [w, v] of Object.entries(body.verdicts ?? {})) cache.set(w, v);
    // words the server skipped (too long, not Malayalam) count as fine, so they aren't asked again
    for (const w of words) if (!cache.has(w)) cache.set(w, { k: "ok" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function flush() {
  timer = null;
  const batch = queue;
  queue = [];
  const words = [...new Set(batch.flatMap((b) => b.words))].filter((w) => !cache.has(w));
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += MAX_WORDS) chunks.push(words.slice(i, i + MAX_WORDS));
  Promise.all(chunks.map(send)).then((oks) => {
    const ok = oks.every(Boolean);
    if (!ok) pausedUntil = Date.now() + 60_000;
    batch.forEach((b) => b.done(ok));
  });
}

/** The engine for the spelling check (shared spell.ts): verdicts for the words, or null. */
export const spellEngine: SpellEngine = async (words) => {
  const missing = words.filter((w) => !cache.has(w));
  if (missing.length) {
    if (Date.now() < pausedUntil || (typeof navigator !== "undefined" && navigator.onLine === false)) return null;
    const ok = await new Promise<boolean>((done) => {
      queue.push({ words: missing, done });
      timer ??= setTimeout(flush, 120);
    });
    if (!ok) return null;
  }
  return new Map(words.map((w) => [w, cache.get(w) ?? { k: "ok" }]));
};
