import { manglishWord } from "./manglish.ts";

const cache = new Map<string, string[]>();

/** Google Input Tools (ml-t-i0-und) candidates for one Manglish word, with offline fallback. */
export async function googleCandidates(word: string, num = 6): Promise<{ candidates: string[]; source: string }> {
  const local = manglishWord(word);
  const key = `${word}:${num}`;
  const hit = cache.get(key);
  if (hit) return { candidates: hit, source: "cache" };
  try {
    const url =
      "https://inputtools.google.com/request?" +
      new URLSearchParams({ text: word, itc: "ml-t-i0-und", num: String(num), cp: "0", cs: "1", ie: "utf-8", oe: "utf-8", app: "litma" });
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const data = await r.json();
    const google: string[] = data?.[0] === "SUCCESS" ? data[1]?.[0]?.[1] ?? [] : [];
    if (!google.length) return { candidates: [local], source: "offline" };
    const merged = Array.from(new Set([...google, local])).slice(0, num + 1);
    if (cache.size > 5000) cache.clear();
    cache.set(key, merged);
    return { candidates: merged, source: "google" };
  } catch {
    return { candidates: [local], source: "offline" };
  }
}

/** Transliterate a whole phrase word by word. */
export async function transliteratePhrase(text: string): Promise<string> {
  const parts = text.split(/([A-Za-z~_^]+)/);
  const out = await Promise.all(parts.map(async (p) => (/^[A-Za-z~_^]+$/.test(p) ? (await googleCandidates(p, 1)).candidates[0] : p)));
  return out.join("");
}
