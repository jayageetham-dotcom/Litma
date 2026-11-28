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
 * A journal's title starts as its date (`journalTitle`), which doesn't count as naming it.
 */
export function keepOnClose(doc: {
  title: string | null | undefined;
  kind: DocKind;
  content: Node | null | undefined;
  /** the work's `created_at`; a journal still titled with this date counts as not named */
  createdAt?: Date | string | number | null;
}): boolean {
  const named = doc.kind === "diary" ? !isUntitledJournal(doc.title, doc.createdAt) : !isDefaultTitle(doc.title, doc.kind);
  return named || hasWriting(doc.content, doc.kind);
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

// Journal dates. Fixed tables, never Intl / toLocaleDateString: ICU writes ZWNJ forms (ഞായറാഴ്‌ച)
// that the phone app's tables don't, so web and phone would write different datelines.
// Phone: lib/data/forms.dart, same names and answers.

/** Full Malayalam month names, January first. */
export const ML_MONTHS = ["ജനുവരി", "ഫെബ്രുവരി", "മാർച്ച്", "ഏപ്രിൽ", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗസ്റ്റ്", "സെപ്റ്റംബർ", "ഒക്ടോബർ", "നവംബർ", "ഡിസംബർ"];
/** Short month names for cards and dates ("28 നവം"), January first. */
export const ML_MONTHS_SHORT = ["ജനു", "ഫെബ്രു", "മാർ", "ഏപ്രി", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗ", "സെപ്റ്റം", "ഒക്ടോ", "നവം", "ഡിസം"];
/** Full weekday names, Sunday first (as `Date.getDay()`). */
export const ML_WEEKDAYS = ["ഞായറാഴ്ച", "തിങ്കളാഴ്ച", "ചൊവ്വാഴ്ച", "ബുധനാഴ്ച", "വ്യാഴാഴ്ച", "വെള്ളിയാഴ്ച", "ശനിയാഴ്ച"];
/** Short weekday names, Sunday first. */
export const ML_WEEKDAYS_SHORT = ["ഞായർ", "തിങ്കൾ", "ചൊവ്വ", "ബുധൻ", "വ്യാഴം", "വെള്ളി", "ശനി"];

type DateIn = Date | string | number;
const asDate = (d: DateIn): Date => (d instanceof Date ? d : new Date(d));

/** A date as a journal heading, in the writer's local day: "2026 നവംബർ 28, ശനിയാഴ്ച". */
export function todayLine(d: DateIn = new Date()): string {
  const x = asDate(d);
  return `${x.getFullYear()} ${ML_MONTHS[x.getMonth()]} ${x.getDate()}, ${ML_WEEKDAYS[x.getDay()]}`;
}

/** The parts of a journal card's calendar block: { day: 28, month: "നവം", weekday: "ശനി" }. */
export function journalDay(d: DateIn): { day: number; month: string; weekday: string } {
  const x = asDate(d);
  return { day: x.getDate(), month: ML_MONTHS_SHORT[x.getMonth()], weekday: ML_WEEKDAYS_SHORT[x.getDay()] };
}

/** "28 നവം", or "28 നവം 2025" when the date isn't in the current year of `now`. */
export function shortDate(d: DateIn, now: DateIn = new Date()): string {
  const x = asDate(d);
  const s = `${x.getDate()} ${ML_MONTHS_SHORT[x.getMonth()]}`;
  return x.getFullYear() === asDate(now).getFullYear() ? s : `${s} ${x.getFullYear()}`;
}

/** The month line that divides the journal list: "2026 നവംബർ". */
export function monthLine(d: DateIn): string {
  const x = asDate(d);
  return `${x.getFullYear()} ${ML_MONTHS[x.getMonth()]}`;
}

/** The title a new journal gets: its started date as a heading (same as `todayLine`). */
export function journalTitle(d: DateIn = new Date()): string {
  return todayLine(d);
}

/** True when two dates fall on the same local day. */
export function sameDay(a: DateIn, b: DateIn): boolean {
  const x = asDate(a);
  const y = asDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

const plainTitle = (t: string) => t.replace(/[\u200c\u200d]/g, "").replace(/\s+/g, " ").trim();

/**
 * A journal the writer hasn't named: the title is empty, an old default (പുതിയ ജേണൽ, പുതിയ ഡയറി),
 * or still its started date as the apps write it (`journalTitle`, or `shortDate` with or without
 * the year). Without `createdAt` only the empty title and the old defaults count.
 */
export function isUntitledJournal(title: string | null | undefined, createdAt?: DateIn | null): boolean {
  const t = plainTitle(title ?? "");
  if (isDefaultTitle(t, "diary")) return true;
  if (createdAt == null || createdAt === "") return false;
  const c = asDate(createdAt);
  if (Number.isNaN(c.getTime())) return false;
  const day = `${c.getDate()} ${ML_MONTHS_SHORT[c.getMonth()]}`;
  return t === journalTitle(c) || t === day || t === `${day} ${c.getFullYear()}`;
}
