import type { JSONContent } from "@tiptap/core";
import { inlineText } from "@/shared/serialize";
import { aksharas, countWords } from "@/shared/manglish";

export interface SceneRow {
  n: number;
  heading: string;
  time: string;
  cast: string[];
  speakers: string[];
  words: number;
}

const cueName = (s: string) => s.replace(/\(.*?\)/g, "").replace(/[:：]\s*$/, "").trim();

/** Scene, character and location breakdown for screenplays / plays. */
export function scriptReport(doc: JSONContent) {
  const scenes: SceneRow[] = [];
  const chars = new Map<string, { lines: number; words: number; scenes: Set<number> }>();
  let cur: SceneRow | null = null;
  for (const n of doc.content ?? []) {
    const t = inlineText(n).trim();
    if (n.type === "sceneHeading" || (n.type === "styledBlock" && n.attrs?.variant === "chapter")) {
      cur = { n: scenes.length + 1, heading: t || "—", time: "", cast: [], speakers: [], words: 0 };
      scenes.push(cur);
      continue;
    }
    if (!cur) {
      cur = { n: 1, heading: "(before first scene)", time: "", cast: [], speakers: [], words: 0 };
      scenes.push(cur);
    }
    if (n.type === "sceneTime") cur.time = t;
    else if (n.type === "sceneCast") cur.cast = t.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
    else if (n.type === "dialogue") {
      const name = cueName(inlineText(n.content?.[0] ?? {}));
      const w = countWords(inlineText(n.content?.[1] ?? {}));
      cur.words += w;
      if (name) {
        if (!cur.speakers.includes(name)) cur.speakers.push(name);
        const c = chars.get(name) ?? { lines: 0, words: 0, scenes: new Set<number>() };
        c.lines++;
        c.words += w;
        c.scenes.add(cur.n);
        chars.set(name, c);
      }
    } else cur.words += countWords(t);
  }
  const locations = new Map<string, number[]>();
  for (const s of scenes) {
    const loc = s.heading.replace(/^(int|ext|int\.\/ext|i\/e)[./\s]*/i, "").replace(/^\/+/, "").trim() || s.heading;
    locations.set(loc, [...(locations.get(loc) ?? []), s.n]);
  }
  return {
    scenes,
    characters: [...chars.entries()].map(([name, c]) => ({ name, lines: c.lines, words: c.words, scenes: [...c.scenes] })).sort((a, b) => b.lines - a.lines),
    locations: [...locations.entries()].map(([name, list]) => ({ name, scenes: list })).sort((a, b) => b.scenes.length - a.scenes.length),
  };
}

/** Chapter word counts and how often each name appears, for prose. */
export function proseReport(doc: JSONContent, names: string[]) {
  const chapters: { title: string; words: number }[] = [];
  let cur = { title: "(opening)", words: 0 };
  let all = "";
  for (const n of doc.content ?? []) {
    const t = inlineText(n);
    all += t + "\n";
    if ((n.type === "styledBlock" && n.attrs?.variant === "chapter") || n.type === "heading") {
      if (cur.words || chapters.length) chapters.push(cur);
      cur = { title: t || "—", words: 0 };
    } else cur.words += countWords(t);
  }
  chapters.push(cur);
  const mentions = names
    .filter(Boolean)
    .map((name) => ({ name, count: all.split(name).length - 1 }))
    .sort((a, b) => b.count - a.count);
  return { chapters: chapters.filter((c) => c.words || c.title !== "(opening)"), mentions, total: countWords(all) };
}

/** Lines, stanzas and metre spread for verse. */
export function verseReport(doc: JSONContent) {
  let lines = 0,
    stanzas = 0,
    inStanza = false;
  const counts: number[] = [];
  for (const n of doc.content ?? []) {
    if (n.type !== "paragraph") {
      inStanza = false;
      continue;
    }
    const t = inlineText(n).trim();
    if (!t) {
      inStanza = false;
      continue;
    }
    if (!inStanza) stanzas++;
    inStanza = true;
    lines++;
    counts.push(aksharas(t).length);
  }
  const freq = new Map<number, number>();
  counts.forEach((c) => freq.set(c, (freq.get(c) ?? 0) + 1));
  return { lines, stanzas, avg: counts.length ? +(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1) : 0, spread: [...freq.entries()].sort((a, b) => a[0] - b[0]) };
}
