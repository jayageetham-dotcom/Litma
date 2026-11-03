import type { JSONContent } from "@tiptap/core";
import type { DocKind, DocSettings } from "./types";
import type { BlockVariant } from "@/extensions/blocks";
import { FORM_NAMES, settingsFor as sharedSettingsFor, starterContent } from "@litma/shared/forms";

export { DEFAULT_SETTINGS } from "@litma/shared/forms";

export interface Template {
  kind: DocKind;
  ml: string;
  en: string;
  blurb: string;
  /** block variants offered in this template's toolbar */
  blocks: BlockVariant[];
  screenplay?: boolean;
  dialogue?: boolean;
  metre?: boolean;
  /** essays and features: footnotes listed at the end */
  footnotes?: boolean;
  /** novels and stories: "Scene break ⁂" in the block menu */
  sceneBreak?: boolean;
  settings: DocSettings;
  content: () => JSONContent;
}

type TemplateMeta = Omit<Template, "settings" | "content">;

const META: TemplateMeta[] = [
  {
    kind: "novel",
    ml: "നോവൽ",
    en: "Novel",
    blurb: "Chapters (numbered if you like), scene breaks and indented paragraphs, set like a printed book.",
    blocks: ["title", "author", "epigraph", "chapter"],
    sceneBreak: true,
  },
  {
    kind: "story",
    ml: "ചെറുകഥ",
    en: "Short story",
    blurb: "A single sitting: title, byline and clean prose with section breaks.",
    blocks: ["title", "author", "epigraph", "subhead"],
    sceneBreak: true,
  },
  {
    kind: "poem",
    ml: "കവിത",
    en: "Poem",
    blurb: "Verse line by line, in stanzas, with an akshara counter and laghu–guru marks for വൃത്തം.",
    blocks: ["title", "author", "epigraph", "stanza"],
    metre: true,
  },
  {
    kind: "screenplay",
    ml: "തിരക്കഥ",
    en: "Screenplay",
    blurb: "Malayalam film format: numbered scenes, Int./Ext. and time, cast list, action on the left, dialogue in two columns.",
    blocks: ["title", "author"],
    screenplay: true,
  },
  {
    kind: "feature",
    ml: "ഫീച്ചർ",
    en: "Feature writing",
    blurb: "Magazine layout: kicker, headline, standfirst, byline, subheads, pull quotes, info boxes and footnotes.",
    blocks: ["kicker", "title", "standfirst", "byline", "subhead", "pullquote", "infobox", "caption"],
    footnotes: true,
  },
  {
    kind: "essay",
    ml: "ലേഖനം",
    en: "Essay / article",
    blurb: "Argument-first prose with headings, quotations, footnotes and references.",
    blocks: ["title", "subtitle", "author", "subhead", "pullquote", "references"],
    footnotes: true,
  },
  {
    kind: "drama",
    ml: "നാടകം",
    en: "Drama / play",
    blurb: "Stage play: cast list, numbered acts and scenes (അങ്കം, രംഗം), stage directions and speaker lines.",
    blocks: ["title", "author", "subhead", "act", "scene", "stage"],
    dialogue: true,
  },
  {
    kind: "lyrics",
    ml: "ഗാനം",
    en: "Song lyrics",
    blurb: "പല്ലവി, അനുപല്ലവി, ചരണം: labelled parts, repeat lines, song details and metre counts.",
    blocks: ["title", "credits", "subtitle", "part", "refrain"],
    metre: true,
  },
  {
    kind: "diary",
    ml: "ഡയറി",
    en: "Diary / memoir",
    blurb: "Dated entries for journals, travelogues and memoir drafts. New entry adds today's date.",
    blocks: ["title", "dateline", "subhead"],
  },
  {
    kind: "blank",
    ml: "ശൂന്യം",
    en: "Blank page",
    blurb: "An empty A4 page. Use any heading or block from the toolbar.",
    blocks: ["title", "subtitle", "author", "subhead", "pullquote"],
  },
];

export const TEMPLATES: Template[] = META.map((m) => ({
  ...m,
  ml: FORM_NAMES[m.kind].ml,
  en: FORM_NAMES[m.kind].en,
  settings: sharedSettingsFor(m.kind),
  content: () => starterContent(m.kind) as JSONContent,
}));

export const templateFor = (kind: DocKind) => TEMPLATES.find((t) => t.kind === kind) ?? TEMPLATES[TEMPLATES.length - 1];

export const settingsFor = sharedSettingsFor;

/**
 * Classes that carry a work's own layout choices onto any page that shows it (editor, reader,
 * PDF, book): the writing type, chapter numbers, Malayalam or English scene/act labels, centred verse.
 */
export function docClasses(kind: DocKind, settings: Partial<DocSettings> | undefined): string {
  const s = settings ?? {};
  const cls = [`tpl-${kind}`];
  if ((kind === "novel" || kind === "story") && s.chapterNumbers) cls.push("chapter-numbers");
  if (kind === "screenplay" || kind === "drama") {
    if (s.headingLabels === "en") cls.push("labels-en");
    else if (s.headingLabels === "ml" || kind === "drama") cls.push("labels-ml");
  }
  if ((kind === "poem" || kind === "lyrics") && s.verseAlign === "center") cls.push("verse-center");
  return cls.join(" ");
}

export const FONTS = [
  { name: "Noto Serif Malayalam", note: "Book serif" },
  { name: "Noto Sans Malayalam", note: "Clean sans" },
  { name: "Manjari", note: "Rounded, poetic" },
  { name: "Gayathri", note: "Light, modern" },
  { name: "Anek Malayalam", note: "Contemporary" },
  { name: "Baloo Chettan 2", note: "Display" },
  { name: "Chilanka", note: "Handwritten" },
];
