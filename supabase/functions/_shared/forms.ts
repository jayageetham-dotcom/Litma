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
  pageSize: PageSizeKey;
  margins: { top: number; bottom: number; left: number; right: number };
  font: string;
  fontSize: number; // pt
  lineHeight: number;
  showMetre?: boolean;
  goal?: number;
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
  /** true until the writer types anything; untouched new documents are discarded on close */
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
  diary: { ml: "ഡയറി", en: "Diary / memoir" },
  blank: { ml: "ശൂന്യം", en: "Blank page" },
};

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

/** Today's date as a diary heading, e.g. "2026 നവംബർ 3, ചൊവ്വാഴ്ച". */
export function todayLine(d = new Date()): string {
  return d.toLocaleDateString("ml-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}
