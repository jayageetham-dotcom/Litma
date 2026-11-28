/**
 * The writing types (സാഹിത്യരൂപം) Litma supports — names, page settings and starter content.
 * Dependency-free: shared by the web app and the Supabase Edge Functions.
 */
import type { JSONContent } from "./serialize.ts";

export type DocKind = "novel" | "story" | "poem" | "screenplay" | "feature" | "essay" | "drama" | "lyrics" | "diary" | "blank";
export type PageSizeKey = "A4" | "A5" | "Letter" | "Legal";
export type InputMode = "manglish" | "malayalam" | "english";

export interface CharacterNote {
  name: string;
  note: string;
}

export interface DocSettings {
  /** spellings the writer chose Ignore for in this work: not marked here again (every device) */
  spellIgnored?: string[];
  pageSize: PageSizeKey;
  margins: { top: number; bottom: number; left: number; right: number };
  font: string;
  fontSize: number; // pt
  lineHeight: number;
  showMetre?: boolean;
  goal?: number;
  /** "YYYY-MM-DD": finish the work's word goal by this day (goals panel shows words a day) */
  deadline?: string;
  notes?: string;
  /** Beat board columns (acts, chapters…) in order; undefined = the writing type's defaults. */
  beatColumns?: string[];
  characters?: CharacterNote[];
  header?: string;
  inputMode?: InputMode;
  /** novel/story: print "അദ്ധ്യായം 1" above each chapter heading */
  chapterNumbers?: boolean;
  /** screenplay/drama: numbered headings read "രംഗം 1" / "അങ്കം 1" ("ml") or "Scene 1" / "Act 1" ("en").
   *  Unset: screenplays keep the older "Scene: 1", plays use Malayalam. */
  headingLabels?: "ml" | "en";
  /** poem/lyrics: lines start at the left ("start", default) or sit centred ("center") */
  verseAlign?: "start" | "center";
  /** true while a new work has neither its own title nor any text (`keepOnClose`); such works are discarded on close */
  pristine?: boolean;
}

export const KINDS: DocKind[] = ["novel", "story", "poem", "screenplay", "feature", "essay", "drama", "lyrics", "diary", "blank"];

export const FORM_NAMES: Record<DocKind, { ml: string; en: string }> = {
  novel: { ml: "നോവൽ", en: "Novel" },
  story: { ml: "ചെറുകഥ", en: "Short story" },
  poem: { ml: "കവിത", en: "Poem" },
  screenplay: { ml: "തിരക്കഥ", en: "Screenplay" },
  feature: { ml: "ഫീച്ചർ", en: "Feature writing" },
  essay: { ml: "ലേഖനം", en: "Essay / article" },
  drama: { ml: "നാടകം", en: "Drama / play" },
  lyrics: { ml: "ഗാനം", en: "Song lyrics" },
  diary: { ml: "ജേണൽ", en: "Journal" },
  blank: { ml: "കുറിപ്പ്", en: "Note" },
};

/** Order in the writing-type pickers: a plain note first, then the types with templates. */
export const PICKER_KINDS: DocKind[] = ["blank", ...KINDS.filter((k) => k !== "blank")];

/** The title a new work gets: "പുതിയ കുറിപ്പ്", "പുതിയ നോവൽ"… */
export function defaultTitle(kind: DocKind): string {
  return `പുതിയ ${(FORM_NAMES[kind] ?? FORM_NAMES.blank).ml}`;
}

/** Titles older apps gave new works, before a writing type was renamed. */
const OLD_TITLES: Partial<Record<DocKind, string[]>> = { blank: ["പുതിയ ശൂന്യം"], diary: ["പുതിയ ഡയറി"] };

/** True when the title is still the one a new work got (empty counts too): the writer hasn't named it. */
export function isDefaultTitle(title: string | null | undefined, kind: DocKind): boolean {
  const t = (title ?? "").trim();
  return !t || t === defaultTitle(kind) || (OLD_TITLES[kind] ?? []).includes(t);
}

/** A new note still called "പുതിയ ശൂന്യം" (older apps) shows the current name instead; other titles pass through. */
export function currentTitle(title: string, kind: DocKind): string {
  return kind === "blank" && title.trim() === "പുതിയ ശൂന്യം" ? defaultTitle(kind) : title;
}

type Node = { type?: string; text?: string; attrs?: Record<string, any> | null; content?: Node[] };
const textOf = (n: Node): string => (n.text ?? "") + (n.content ?? []).map(textOf).join("");
/** Lines a new work fills in by itself: the writer's name and a journal's date. */
const AUTO_FILLED = new Set(["author", "byline", "dateline"]);

/**
 * Has the writer written anything in the body? Text the app put there itself (the author line,
 * a journal's date, a template's labels such as പല്ലവി or കഥാപാത്രങ്ങൾ) doesn't count.
 */
export function hasWriting(content: Node | null | undefined, kind: DocKind): boolean {
  const starter = new Set((starterContent(kind).content ?? []).map((b) => textOf(b as Node).trim()).filter(Boolean));
  return (content?.content ?? []).some((b) => {
    const t = textOf(b).trim();
    if (!t) return false;
    if (b.type === "styledBlock" && AUTO_FILLED.has(String(b.attrs?.variant))) return false;
    return !starter.has(t);
  });
}

/**
 * The keep rule for a new work, the same for every writing type: it stays when the writer changed
 * its title or wrote any body text; otherwise closing it deletes it (and the desk's cleanup does).
 */
export function keepOnClose(doc: { title: string | null | undefined; kind: DocKind; content: Node | null | undefined }): boolean {
  return !isDefaultTitle(doc.title, doc.kind) || hasWriting(doc.content, doc.kind);
}

export const DEFAULT_SETTINGS: DocSettings = {
  pageSize: "A4",
  margins: { top: 25, bottom: 25, left: 25, right: 25 },
  font: "Noto Serif Malayalam",
  fontSize: 12,
  lineHeight: 1.75,
  goal: 0,
  notes: "",
  characters: [],
  inputMode: "manglish",
};

const FORM_SETTINGS: Record<DocKind, Partial<DocSettings>> = {
  novel: { font: "Noto Serif Malayalam", fontSize: 12, lineHeight: 1.8, margins: { top: 25, bottom: 25, left: 28, right: 25 } },
  story: { font: "Noto Serif Malayalam", fontSize: 12, lineHeight: 1.8 },
  poem: { font: "Manjari", fontSize: 13, lineHeight: 1.9, showMetre: false, margins: { top: 30, bottom: 25, left: 30, right: 30 } },
  screenplay: { font: "Noto Sans Malayalam", fontSize: 11, lineHeight: 1.65, margins: { top: 22, bottom: 22, left: 22, right: 22 } },
  feature: { font: "Noto Serif Malayalam", fontSize: 11.5, lineHeight: 1.75 },
  essay: { font: "Noto Serif Malayalam", fontSize: 12, lineHeight: 1.75 },
  drama: { font: "Noto Serif Malayalam", fontSize: 12, lineHeight: 1.7 },
  lyrics: { font: "Manjari", fontSize: 13, lineHeight: 1.9, showMetre: false },
  diary: { font: "Gayathri", fontSize: 13, lineHeight: 1.85 },
  blank: {},
};

export function settingsFor(kind: DocKind): DocSettings {
  const f = FORM_SETTINGS[kind] ?? {};
  return { ...DEFAULT_SETTINGS, ...f, margins: { ...DEFAULT_SETTINGS.margins, ...(f.margins ?? {}) } };
}

/**
 * Settings for a brand-new work. A few choices apply only to works made from now on, so older works
 * keep their look: new screenplays number scenes "രംഗം 1" (older ones keep "Scene: 1").
 */
export function newSettings(kind: DocKind): DocSettings {
  const s = settingsFor(kind);
  if (kind === "screenplay") s.headingLabels = "ml";
  return s;
}

const sb = (variant: string, text?: string): JSONContent => ({ type: "styledBlock", attrs: { variant }, content: text ? [{ type: "text", text }] : undefined });
const p = (text?: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : undefined });
const node = (type: string, text?: string): JSONContent => ({ type, content: text ? [{ type: "text", text }] : undefined });
const dlg = (): JSONContent => ({ type: "dialogue", content: [node("dialogueCue"), node("dialogueSpeech")] });
const cast = (): JSONContent => ({ type: "castEntry", content: [node("castName"), node("castRole")] });

export function starterContent(kind: DocKind): JSONContent {
  switch (kind) {
    case "novel":
      return { type: "doc", content: [sb("title"), sb("author"), sb("epigraph"), sb("chapter"), p()] };
    case "story":
      return { type: "doc", content: [sb("title"), sb("author"), p()] };
    case "essay":
      return { type: "doc", content: [sb("title"), sb("subtitle"), sb("author"), p()] };
    case "poem":
      return { type: "doc", content: [sb("title"), sb("author"), p()] };
    case "screenplay":
      return { type: "doc", content: [node("sceneHeading"), node("sceneTime"), node("sceneCast"), node("action"), dlg()] };
    case "feature":
      return { type: "doc", content: [sb("kicker"), sb("title"), sb("standfirst"), sb("byline"), p()] };
    case "drama":
      return {
        type: "doc",
        content: [sb("title"), sb("author"), sb("subhead", "കഥാപാത്രങ്ങൾ"), cast(), sb("scene"), sb("stage"), dlg()],
      };
    case "lyrics":
      return { type: "doc", content: [sb("title"), sb("credits"), sb("part", "പല്ലവി"), p(), sb("part", "അനുപല്ലവി"), p(), sb("part", "ചരണം"), p()] };
    case "diary":
      return { type: "doc", content: [sb("title"), sb("dateline", todayLine()), p()] };
    default:
      return { type: "doc", content: [p()] };
  }
}

/**
 * A new work's author line filled with the writer's name (pen name, else profile name), so they
 * don't type it into every work. Only an empty author or byline line is filled.
 */
export function withAuthor(content: JSONContent, name: string | null | undefined): JSONContent {
  const n = name?.trim();
  if (!n) return content;
  let done = false;
  const blocks = (content.content ?? []).map((b) => {
    if (done || b.type !== "styledBlock" || !["author", "byline"].includes(b.attrs?.variant) || b.content?.length) return b;
    done = true;
    return { ...b, content: [{ type: "text", text: n }] };
  });
  return { ...content, content: blocks };
}

/** Today's date as a diary heading, e.g. "2026 നവംബർ 3, ചൊവ്വാഴ്ച". */
export function todayLine(d = new Date()): string {
  return d.toLocaleDateString("ml-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}
